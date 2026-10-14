import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto.js';
import { PaymentService } from './payment/payment.service.js';

const ORDER_INCLUDE = {
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
} as const;

type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

/** Allowed status transitions; enforced in cancel()/pay(). */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });
      if (cartItems.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Re-check every line inside the transaction: product still exists,
      // still active, and stock still covers the quantity. All money math in
      // Prisma.Decimal to keep full precision on the write path.
      let total = new Prisma.Decimal(0);
      for (const item of cartItems) {
        const { product, quantity } = item;
        if (!product) {
          // Defensive: the FK cascade normally removes cart rows with the
          // product, but a stale row must still reject cleanly, not 500.
          throw new BadRequestException(
            `Product "${item.productId}" is no longer available`,
          );
        }
        if (!product.isActive) {
          throw new BadRequestException(
            `Product "${product.name}" is no longer available`,
          );
        }
        if (quantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${quantity})`,
          );
        }
        total = total.plus(product.price.mul(quantity));
      }

      const created = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          totalAmount: total,
          shippingAddress:
            dto.shippingAddress as unknown as Prisma.InputJsonValue,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price, // current-price snapshot
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { userId } });
      return created;
    });

    return this.toOrderDto(order);
  }

  /**
   * Guest checkout: no login required. Items come from the client cart,
   * validated against live product data inside a transaction.
   */
  async createGuest(dto: CreateGuestOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      let total = new Prisma.Decimal(0);
      const lines: { productId: string; quantity: number; unitPrice: Prisma.Decimal }[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product || !product.isActive) {
          throw new BadRequestException(
            `Product "${item.productId}" is no longer available`
          );
        }
        if (item.quantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${item.quantity})`
          );
        }
        total = total.plus(product.price.mul(item.quantity));
        lines.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      const created = await tx.order.create({
        data: {
          userId: null,
          status: OrderStatus.PENDING,
          totalAmount: total,
          paymentMethod: 'cod',
          guestName: dto.name,
          guestPhone: dto.phone,
          guestEmail: dto.email ?? null,
          shippingAddress: {
            name: dto.name,
            street: dto.address,
            city: '',
            postalCode: '',
            country: 'Bangladesh',
            phone: dto.phone,
            email: dto.email ?? null,
          } as unknown as Prisma.InputJsonValue,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      return created;
    });

    return this.toOrderDto(order);
  }

  async findAll(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map((o) => this.toOrderDto(o));
  }

  async findOne(userId: string, id: string) {
    return this.toOrderDto(await this.findOwned(userId, id));
  }

  async cancel(userId: string, id: string) {
    const order = await this.findOwned(userId, id);
    this.assertTransition(order.status, OrderStatus.CANCELLED);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
        include: ORDER_INCLUDE,
      });
      // Restore stock reserved by the cancelled order.
      for (const item of updated.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      return updated;
    });

    return this.toOrderDto(cancelled);
  }

  async pay(userId: string, id: string) {
    const order = await this.findOwned(userId, id);
    this.assertTransition(order.status, OrderStatus.PAID);

    const amount = order.totalAmount.toNumber();
    const result = await this.paymentService.charge(order.id, amount);
    if (!result.success) {
      throw new BadRequestException('Payment failed');
    }

    const paid = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.PAID },
      include: ORDER_INCLUDE,
    });
    return this.toOrderDto(paid);
  }

  /**
   * Loads an order only when it belongs to the user. A different user's order
   * id yields 404 (same as a missing id), so existence is never leaked.
   */
  private async findOwned(userId: string, id: string): Promise<OrderWithItems> {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }
    return order;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move order from ${from} to ${to}`,
      );
    }
  }

  private toOrderDto(order: OrderWithItems) {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
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
