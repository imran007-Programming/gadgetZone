import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto.js';
import { PaymentService } from './payment/payment.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { resolveBdLocation } from '../common/bd-locations.js';

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
  // Latest return request, shown on the customer order page
  returnRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
} as const;

type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

/** Written onto a new order; both null when the checkout sent no Idempotency-Key. */
interface IdempotencyFields {
  idempotencyKey: string | null;
  idempotencyHash: string | null;
}

/** A UUID or similar random token from the client. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;

function parseIdempotencyKey(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(raw)) {
    throw new BadRequestException('Invalid Idempotency-Key header');
  }
  return raw;
}

/** JSON with sorted keys, so the same body always hashes the same way. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function requestHash(body: object): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

/** The unique index on Order.idempotencyKey rejected a second order with the same key. */
function isIdempotencyKeyClash(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    String(err.meta?.target ?? '').includes('idempotencyKey')
  );
}

/** Allowed status transitions; enforced in cancel()/pay(). */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Shipping address as stored on the order. district/upazila/union are checked
 * against the real BD location tree; `city` mirrors the district for older
 * readers of the JSON.
 */
function buildShippingAddress(input: {
  name: string;
  phone: string;
  email?: string;
  street: string;
  district: string;
  upazila: string;
  union?: string;
  postalCode?: string;
}) {
  const loc = resolveBdLocation(input);
  return {
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    street: input.street,
    union: loc.union ?? null,
    upazila: loc.upazila,
    district: loc.district,
    division: loc.division,
    city: loc.district,
    postalCode: input.postalCode ?? '',
    country: 'Bangladesh',
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly coupons: CouponsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto, idempotencyKey?: string) {
    return this.onceForKey(idempotencyKey, userId, dto, (idempotency) =>
      this.placeOrder(userId, dto, idempotency),
    );
  }

  private async placeOrder(userId: string, dto: CreateOrderDto, idempotency: IdempotencyFields) {
    const shippingAddress = buildShippingAddress(dto.shippingAddress);
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

      await this.reserveStock(tx, cartItems);

      const { coupon, discount } = await this.applyCoupon(tx, dto.couponCode, total);
      const delivery = await this.deliveryFor(tx, shippingAddress.district, dto.transactionId);

      const created = await tx.order.create({
        data: {
          userId,
          ...idempotency,
          status: OrderStatus.PENDING,
          totalAmount: total.minus(discount).plus(delivery.fee),
          discountAmount: discount,
          ...this.checkoutExtras(delivery, dto),
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
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

      if (coupon) await this.coupons.consume(tx, coupon.id);
      await tx.cartItem.deleteMany({ where: { userId } });
      return created;
    });

    return order;
  }

  /**
   * Places an order at most once per Idempotency-Key. The checkout sends one key per
   * attempt and resends it on a retry (e.g. after a timeout), so the retry gets the
   * order the first attempt already made instead of a duplicate. The key is looked up
   * first, before the cart check, since a successful order empties the cart.
   */
  private async onceForKey(
    rawKey: string | undefined,
    userId: string | null,
    body: object,
    place: (idempotency: IdempotencyFields) => Promise<OrderWithItems>,
  ) {
    const key = parseIdempotencyKey(rawKey);
    if (!key) return this.toOrderDto(await place({ idempotencyKey: null, idempotencyHash: null }));

    const hash = requestHash(body);
    const earlier = await this.findByIdempotencyKey(key, hash, userId);
    if (earlier) return this.toOrderDto(earlier);
    try {
      return this.toOrderDto(await place({ idempotencyKey: key, idempotencyHash: hash }));
    } catch (err) {
      // Two requests with the same key at once: the unique index let only one order in,
      // and this attempt's transaction (stock included) rolled back. Return the winner.
      if (!isIdempotencyKeyClash(err)) throw err;
      const winner = await this.findByIdempotencyKey(key, hash, userId);
      if (!winner) throw err;
      return this.toOrderDto(winner);
    }
  }

  /** The order an earlier attempt placed with this key, if it is the same checkout. */
  private async findByIdempotencyKey(key: string, hash: string, userId: string | null) {
    const order = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: ORDER_INCLUDE,
    });
    if (!order) return null;
    // Another account, or the same key with a different cart or address: never hand back
    // that order, and never place a second one under the same key either.
    if (order.userId !== userId || order.idempotencyHash !== hash) {
      throw new ConflictException(
        'An order was already placed from this checkout. Check your orders, or refresh the page to start a new one.',
      );
    }
    return order;
  }

  /**
   * Takes the ordered quantities out of stock. The check and the decrement are one
   * atomic UPDATE ... WHERE stock >= quantity: when two checkouts race for the last
   * unit, the second waits for the first, then finds the condition false, and its
   * whole transaction rolls back. (Checking first and decrementing later let both
   * pass and pushed stock below zero.) Rows are updated in id order so two carts
   * with the same products never lock them in opposite order and deadlock.
   */
  private async reserveStock(
    tx: Prisma.TransactionClient,
    lines: { productId: string; quantity: number }[],
  ) {
    const ordered = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
    for (const { productId, quantity } of ordered) {
      const { count } = await tx.product.updateMany({
        where: { id: productId, isActive: true, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (count === 0) {
        // Lost the race: read what is left to name it in the error
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { name: true, stock: true, isActive: true },
        });
        if (!product || !product.isActive) {
          throw new BadRequestException(`Product "${product?.name ?? productId}" is no longer available`);
        }
        throw new BadRequestException(
          `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${quantity})`,
        );
      }
    }
  }

  /**
   * Guest checkout: no login required. Items come from the client cart,
   * validated against live product data inside a transaction.
   */
  async createGuest(dto: CreateGuestOrderDto, idempotencyKey?: string) {
    return this.onceForKey(idempotencyKey, null, dto, (idempotency) =>
      this.placeGuestOrder(dto, idempotency),
    );
  }

  private async placeGuestOrder(dto: CreateGuestOrderDto, idempotency: IdempotencyFields) {
    const shippingAddress = buildShippingAddress({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      street: dto.address,
      district: dto.district,
      upazila: dto.upazila,
      union: dto.union,
      postalCode: dto.postalCode,
    });
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

      await this.reserveStock(tx, lines);

      const { coupon, discount } = await this.applyCoupon(tx, dto.couponCode, total);
      const delivery = await this.deliveryFor(tx, shippingAddress.district, dto.transactionId);

      const created = await tx.order.create({
        data: {
          userId: null,
          ...idempotency,
          status: OrderStatus.PENDING,
          totalAmount: total.minus(discount).plus(delivery.fee),
          discountAmount: discount,
          ...this.checkoutExtras(delivery, dto),
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          paymentMethod: 'cod',
          guestName: dto.name,
          guestPhone: dto.phone,
          guestEmail: dto.email ?? null,
          shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
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

      if (coupon) await this.coupons.consume(tx, coupon.id);
      return created;
    });

    return order;
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
      await this.coupons.release(tx, updated.couponId);
      return updated;
    });

    return this.toOrderDto(cancelled);
  }

  /**
   * Cancels PENDING orders the shop has not confirmed within maxAgeHours and puts their
   * stock and coupon use back, so abandoned or fake cash-on-delivery orders don't hold
   * stock forever. Orders with a bKash/Nagad Transaction ID are left to the admin, since
   * the customer may already have paid the advance. Returns how many were cancelled.
   */
  async cancelStalePendingOrders(maxAgeHours: number, now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
        OR: [{ transactionId: null }, { transactionId: '' }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100, // the next run picks up the rest
    });

    let cancelled = 0;
    for (const { id } of stale) {
      const done = await this.prisma.$transaction(async (tx) => {
        // Only while still PENDING: the admin may have confirmed it in the meantime
        const { count } = await tx.order.updateMany({
          where: { id, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED },
        });
        if (count === 0) return false;
        const order = await tx.order.findUniqueOrThrow({
          where: { id },
          select: { couponId: true, items: { select: { productId: true, quantity: true } } },
        });
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await this.coupons.release(tx, order.couponId);
        return true;
      });
      if (done) cancelled++;
    }
    return cancelled;
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

  /** Validates an optional coupon against the order subtotal inside the transaction. */
  /**
   * Delivery charge for the shipping district (Dhaka district = inside Dhaka),
   * from Admin → Site settings. Outside Dhaka the charge is paid in advance by
   * bKash / Nagad when the store has set a number, so a Transaction ID is required.
   */
  private async deliveryFor(tx: Prisma.TransactionClient, district: string, transactionId?: string) {
    const settings = await tx.siteSetting.findUnique({ where: { id: 'default' } });
    const inside = district === 'Dhaka';
    const fee = new Prisma.Decimal(
      inside ? (settings?.deliveryFeeInsideDhaka ?? 60) : (settings?.deliveryFeeOutsideDhaka ?? 99),
    );
    const advance =
      !inside && (settings?.advanceOutsideDhaka ?? true) && !!(settings?.bkashNumber || settings?.nagadNumber);
    if (advance && !transactionId) {
      throw new BadRequestException('Enter the bKash / Nagad Transaction ID for the advance delivery charge');
    }
    return { fee, zone: inside ? 'inside_dhaka' : 'outside_dhaka' };
  }

  /** Order columns for the delivery charge, notes, Transaction ID and billing contact. */
  private checkoutExtras(
    delivery: { fee: Prisma.Decimal; zone: string },
    dto: { notes?: string; transactionId?: string; billingAddress?: object },
  ) {
    return {
      shippingFee: delivery.fee,
      shippingZone: delivery.zone,
      notes: dto.notes ?? null,
      transactionId: dto.transactionId ?? null,
      ...(dto.billingAddress && {
        billingAddress: { ...dto.billingAddress, country: 'Bangladesh' } as Prisma.InputJsonValue,
      }),
    };
  }

  private async applyCoupon(tx: Prisma.TransactionClient, code: string | undefined, subtotal: Prisma.Decimal) {
    if (!code?.trim()) return { coupon: null, discount: new Prisma.Decimal(0) };
    const coupon = await this.coupons.findApplicable(code, subtotal, tx);
    return { coupon, discount: this.coupons.computeDiscount(coupon, subtotal) };
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
      discountAmount: order.discountAmount.toNumber(),
      couponCode: order.couponCode,
      paymentMethod: order.paymentMethod,
      shippingFee: order.shippingFee.toNumber(),
      shippingZone: order.shippingZone,
      transactionId: order.transactionId,
      notes: order.notes,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      returnRequest: order.returnRequests[0]
        ? {
            id: order.returnRequests[0].id,
            status: order.returnRequests[0].status,
            reason: order.returnRequests[0].reason,
            refundAmount: order.returnRequests[0].refundAmount?.toNumber() ?? null,
            adminNote: order.returnRequests[0].adminNote,
            createdAt: order.returnRequests[0].createdAt,
          }
        : null,
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
