import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const PRODUCT_CATEGORY_SELECT = { id: true, name: true, slug: true } as const;

/** Every product read/write returns the category and its gallery in order. */
const PRODUCT_INCLUDE = {
  category: { select: PRODUCT_CATEGORY_SELECT },
  images: { orderBy: { position: 'asc' } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
} as const;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ------------------------------------------------------------- products

  async createProduct(dto: CreateProductDto) {
    await this.assertCategoryExists(dto.categoryId);
    if (dto.brandId) await this.assertBrandExists(dto.brandId);
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
        imageUrl: dto.imageUrl ?? '',
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
        brandId: dto.brandId || null,
      },
      include: PRODUCT_INCLUDE,
    });
    return this.toProductDto(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.findProductOrThrow(id);

    if (dto.slug !== undefined && dto.slug !== product.slug) {
      await this.assertProductSlugFree(dto.slug);
    }
    if (dto.brandId) await this.assertBrandExists(dto.brandId);
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
        ...(dto.brandId !== undefined && { brandId: dto.brandId || null }),
      },
      include: PRODUCT_INCLUDE,
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
      include: PRODUCT_INCLUDE,
    });
    return this.toProductDto(updated);
  }

  async setProductStock(id: string, stock: number) {
    await this.findProductOrThrow(id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock },
      include: PRODUCT_INCLUDE,
    });
    return this.toProductDto(updated);
  }

  /**
   * Upload one or more images to Cloudinary and attach them to the product.
   * The first image becomes the cover (imageUrl) if the product had none.
   */
  async addProductImages(productId: string, files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('Attach at least one image file');
    }
    const product = await this.findProductOrThrow(productId);
    const folder = `gadgetlax/products/${product.slug}`;
    const startPosition = product.images.length;

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await this.cloudinary.uploadBuffer(file.buffer, folder));
    }

    await this.prisma.productImage.createMany({
      data: uploaded.map((img, i) => ({
        productId,
        url: img.url,
        publicId: img.publicId,
        position: startPosition + i,
      })),
    });

    if (!product.imageUrl) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { imageUrl: uploaded[0].url },
      });
    }

    return this.getProductDto(productId);
  }

  /** Remove one gallery image from Cloudinary and the database. */
  async deleteProductImage(productId: string, imageId: string) {
    const product = await this.findProductOrThrow(productId);
    const image = product.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException(`Image "${imageId}" not found on this product`);
    }

    await this.cloudinary.destroy(image.publicId);
    await this.prisma.productImage.delete({ where: { id: imageId } });

    // Keep the cover valid: if the removed image was the cover, use the next one.
    if (product.imageUrl === image.url) {
      const next = product.images.find((img) => img.id !== imageId);
      await this.prisma.product.update({
        where: { id: productId },
        data: { imageUrl: next?.url ?? '' },
      });
    }

    return this.getProductDto(productId);
  }

  /** Every product, active or not, newest first (admin catalog and inventory). */
  async listProducts() {
    const products = await this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => this.toProductDto(p));
  }

  /** Single product for the admin edit page; includes inactive products. */
  async getProduct(id: string) {
    return this.getProductDto(id);
  }

  private async getProductDto(id: string) {
    const product = await this.findProductOrThrow(id);
    return this.toProductDto(product);
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
        // Give the coupon use back, as the customer cancel flow does
        if (updated.couponId) {
          await tx.coupon.updateMany({
            where: { id: updated.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
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
  /** Non-cancelled orders created today (UTC), bucketed by hour 00–23. */
  async getOrdersByHour() {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start }, status: { not: OrderStatus.CANCELLED } },
      select: { createdAt: true, totalAmount: true },
    });
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, '0'),
      orders: 0,
      revenue: 0,
    }));
    for (const o of orders) {
      const h = o.createdAt.getUTCHours();
      hours[h].orders += 1;
      hours[h].revenue += o.totalAmount.toNumber();
    }
    return {
      date: start.toISOString().slice(0, 10),
      totalOrders: orders.length,
      totalRevenue: hours.reduce((n, h) => n + h.revenue, 0),
      hours,
    };
  }

  /** Revenue and units from paid/shipped/delivered orders, grouped by product category. */
  async getRevenueByCategory() {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED] } },
      },
      select: {
        quantity: true,
        unitPrice: true,
        product: { select: { category: { select: { name: true } } } },
      },
    });
    const byCategory = new Map<string, { category: string; revenue: number; units: number }>();
    for (const item of items) {
      const name = item.product.category.name;
      const row = byCategory.get(name) ?? { category: name, revenue: 0, units: 0 };
      row.revenue += item.unitPrice.toNumber() * item.quantity;
      row.units += item.quantity;
      byCategory.set(name, row);
    }
    return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);
  }

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
      include: PRODUCT_INCLUDE,
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

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundException(`Brand "${brandId}" not found`);
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

  private toProductDto(p: ProductWithRelations) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price.toNumber(),
      comparePrice: p.comparePrice ? p.comparePrice.toNumber() : null,
      stock: p.stock,
      imageUrl: p.imageUrl,
      images: p.images.map((img) => ({
        id: img.id,
        url: img.url,
        position: img.position,
      })),
      isActive: p.isActive,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category,
      brandId: p.brandId,
      brand: p.brand,
    };
  }

  private toAdminOrderDto(order: AdminOrder) {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      discountAmount: order.discountAmount.toNumber(),
      couponCode: order.couponCode,
      guestName: order.guestName,
      guestPhone: order.guestPhone,
      guestEmail: order.guestEmail,
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
