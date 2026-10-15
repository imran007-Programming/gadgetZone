import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const PRODUCT_CATEGORY_SELECT = { id: true, name: true, slug: true } as const;

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: { select: typeof PRODUCT_CATEGORY_SELECT } };
}>;

const ADMIN_ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          imageUrl: true,
        },
      },
    },
  },
  user: { select: { id: true, email: true, name: true } },
} as const;

type AdminOrder = Prisma.OrderGetPayload<{ include: typeof ADMIN_ORDER_INCLUDE }>;

/**
 * Allowed status transitions for admin order management. Admins get one extra
 * edge over customers: PAID -> CANCELLED (with stock restore), for orders
 * that were paid but must be refunded.
 */
const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Fields that are safe to expose for a user (never hashes). */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------- products

  async createProduct(dto: CreateProductDto) {
    await this.assertCategoryExists(dto.categoryId);
    await this.assertProductSlugFree(dto.slug);
    this.assertComparePrice(dto.price, dto.comparePrice);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        comparePrice:
          dto.comparePrice !== undefined
            ? new Prisma.Decimal(dto.comparePrice)
            : undefined,
        stock: dto.stock,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      },
      include: { category: { select: PRODUCT_CATEGORY_SELECT } },
    });
    return this.toProductDto(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.findProductOrThrow(id);

    if (dto.slug !== undefined && dto.slug !== product.slug) {
      await this.assertProductSlugFree(dto.slug);
    }
    if (dto.categoryId !== undefined && dto.categoryId !== product.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    // comparePrice must stay above the (possibly new) price.
    const effectivePrice = dto.price ?? product.price.toNumber();
    const effectiveCompare =
      dto.comparePrice ?? product.comparePrice?.toNumber() ?? null;
    this.assertComparePrice(effectivePrice, effectiveCompare ?? undefined);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
        ...(dto.comparePrice !== undefined && {
          comparePrice: new Prisma.Decimal(dto.comparePrice),
        }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: { select: PRODUCT_CATEGORY_SELECT } },
    });
    return this.toProductDto(updated);
  }

  /**
   * Soft delete: sets isActive=false. Already-inactive products return 200
   * idempotently (same payload), so repeated deletes are safe.
   */
  async softDeleteProduct(id: string) {
    const product = await this.findProductOrThrow(id);
    if (!product.isActive) {
      return this.toProductDto(product);
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: PRODUCT_CATEGORY_SELECT } },
    });
    return this.toProductDto(updated);
  }

  async setProductStock(id: string, stock: number) {
    await this.findProductOrThrow(id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock },
      include: { category: { select: PRODUCT_CATEGORY_SELECT } },
    });
    return this.toProductDto(updated);
  }

  // ------------------------------------------------------------ categories

  async createCategory(dto: CreateCategoryDto) {
    await this.assertCategorySlugFree(dto.slug);
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
    if (dto.slug !== undefined && dto.slug !== category.slug) {
      await this.assertCategorySlugFree(dto.slug);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  /**
   * Deletes a category only when zero products reference it; otherwise 409.
   */
  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${category.name}": ${productCount} product(s) still reference it`,
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // ---------------------------------------------------------------- orders

  async listOrders(status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ADMIN_ORDER_INCLUDE,
    });
    return orders.map((o) => this.toAdminOrderDto(o));
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ADMIN_ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }
    this.assertAdminTransition(order.status, status);

    // Cancelling from PENDING or PAID frees the reserved stock, mirroring the
    // customer cancel flow, inside a transaction.
    if (
      status === OrderStatus.CANCELLED &&
      (order.status === OrderStatus.PENDING || order.status === OrderStatus.PAID)
    ) {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data: { status: OrderStatus.CANCELLED },
          include: ADMIN_ORDER_INCLUDE,
        });
        for (const item of updated.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        return updated;
      });
      return this.toAdminOrderDto(cancelled);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: ADMIN_ORDER_INCLUDE,
    });
    return this.toAdminOrderDto(updated);
  }

  // ----------------------------------------------------------------- users

  async listUsers(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
      select: SAFE_USER_SELECT,
    });
  }

  async getUserOrders(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    const orders = await this.prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: ADMIN_ORDER_INCLUDE,
    });
    return { user, orders: orders.map((o) => this.toAdminOrderDto(o)) };
  }

  /**
   * Disables an account (blocks future logins). Cannot disable yourself and
   * cannot disable another ADMIN account.
   */
  async disableUser(id: string, requesterId: string) {
    const target = await this.findUserOrThrow(id);
    if (id === requesterId) {
      throw new BadRequestException('You cannot disable your own account');
    }
    if (target.role === Role.ADMIN) {
      throw new BadRequestException('Cannot disable another admin account');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: SAFE_USER_SELECT,
    });
  }

  /**
   * Re-enables an account. Unlike disable, enabling is not restricted —
   * it only flips the flag back on.
   */
  async enableUser(id: string) {
    await this.findUserOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: SAFE_USER_SELECT,
    });
  }

  // ----------------------------------------------------------------- stats

  async getStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      revenueAgg,
      grouped,
      lowStock,
      newCustomers,
      totalProducts,
      totalCustomers,
      totalOrders,
    ] = await this.prisma.$transaction([
        this.prisma.order.aggregate({
          where: {
            status: {
              in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
            },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        this.prisma.product.findMany({
          where: { isActive: true, stock: { lt: 10 } },
          select: { id: true, name: true, slug: true, stock: true },
          orderBy: { stock: 'asc' },
          take: 20,
        }),
        this.prisma.user.count({
          where: { role: Role.CUSTOMER, createdAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.product.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
        this.prisma.order.count(),
      ]);

    const ordersByStatus: Record<OrderStatus, number> = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.PAID]: 0,
      [OrderStatus.SHIPPED]: 0,
      [OrderStatus.DELIVERED]: 0,
      [OrderStatus.CANCELLED]: 0,
    };
    for (const row of grouped) {
      ordersByStatus[row.status] = row._count.status;
    }

    return {
      totalRevenue: revenueAgg._sum.totalAmount?.toNumber() ?? 0,
      ordersByStatus,
      lowStock,
      newCustomers30d: newCustomers,
      totalProducts,
      totalCustomers,
      totalOrders,
    };
  }

  /** Monthly revenue + order count for the last 12 months (oldest → newest). */
  async getRevenueTrend() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start },
        status: {
          in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        },
      },
      select: { createdAt: true, totalAmount: true },
    });
    const months: { label: string; revenue: number; orders: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      months.push({
        label: d.toLocaleString('en', { month: 'short' }),
        revenue: 0,
        orders: 0,
      });
    }
    for (const o of orders) {
      const idx =
        (o.createdAt.getFullYear() - start.getFullYear()) * 12 +
        (o.createdAt.getMonth() - start.getMonth());
      if (idx >= 0 && idx < 12) {
        months[idx].revenue += o.totalAmount.toNumber();
        months[idx].orders += 1;
      }
    }
    return months.map((m) => ({
      label: m.label,
      revenue: Math.round(m.revenue * 100) / 100,
      orders: m.orders,
    }));
  }

  /** Top 5 products by units sold (paid/shipped/delivered orders only). */
  async getTopProducts() {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
          },
        },
      },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        product: { select: { name: true, imageUrl: true } },
      },
    });
    const agg = new Map<
      string,
      { name: string; imageUrl: string | null; units: number; revenue: number }
    >();
    for (const i of items) {
      const cur = agg.get(i.productId) ?? {
        name: i.product.name,
        imageUrl: i.product.imageUrl,
        units: 0,
        revenue: 0,
      };
      cur.units += i.quantity;
      cur.revenue += i.quantity * i.unitPrice.toNumber();
      agg.set(i.productId, cur);
    }
    return [...agg.entries()]
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        imageUrl: v.imageUrl,
        unitsSold: v.units,
        revenue: Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);
  }

  // ---------------------------------------------------------------- helpers

  private async findProductOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: PRODUCT_CATEGORY_SELECT } },
    });
    if (!product) {
      throw new NotFoundException(`Product "${id}" not found`);
    }
    return product;
  }

  private async findUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    return user;
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category "${categoryId}" not found`);
    }
  }

  private async assertProductSlugFree(slug: string) {
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Product slug "${slug}" is already taken`);
    }
  }

  private async assertCategorySlugFree(slug: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Category slug "${slug}" is already taken`);
    }
  }

  private assertComparePrice(price: number, comparePrice?: number) {
    if (comparePrice !== undefined && comparePrice <= price) {
      throw new BadRequestException(
        'comparePrice must be greater than price',
      );
    }
  }

  private assertAdminTransition(from: OrderStatus, to: OrderStatus) {
    if (from === to) {
      return; // no-op is allowed
    }
    if (!ADMIN_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Cannot move order from ${from} to ${to}`);
    }
  }

  private toProductDto(p: ProductWithCategory) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price.toNumber(),
      comparePrice: p.comparePrice ? p.comparePrice.toNumber() : null,
      stock: p.stock,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category,
    };
  }

  private toAdminOrderDto(order: AdminOrder) {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      user: order.user,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        product: {
          ...item.product,
          price: item.product.price.toNumber(),
        },
      })),
    };
  }
}
