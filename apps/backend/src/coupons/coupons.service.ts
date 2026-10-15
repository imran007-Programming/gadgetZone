import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Discount for a subtotal; never more than the subtotal itself. */
  computeDiscount(coupon: Pick<Coupon, 'type' | 'value'>, subtotal: Prisma.Decimal): Prisma.Decimal {
    const raw =
      coupon.type === DiscountType.PERCENT
        ? subtotal.mul(coupon.value).div(100)
        : new Prisma.Decimal(coupon.value);
    const capped = Prisma.Decimal.min(raw, subtotal);
    return capped.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  }

  /**
   * Loads a coupon by code and checks it can be used for this subtotal.
   * Throws a 400 with a customer-readable reason otherwise.
   */
  async findApplicable(code: string, subtotal: Prisma.Decimal, tx: Tx | PrismaService = this.prisma) {
    const coupon = await tx.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('This coupon code is not valid');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.minOrder && subtotal.lt(coupon.minOrder)) {
      throw new BadRequestException(
        `This coupon needs a minimum order of ৳${coupon.minOrder.toNumber().toLocaleString('en-IN')}`,
      );
    }
    return coupon;
  }

  /** Checkout preview: what the coupon would take off this subtotal. */
  async validate(code: string, subtotal: number) {
    const sub = new Prisma.Decimal(subtotal);
    const coupon = await this.findApplicable(code, sub);
    const discount = this.computeDiscount(coupon, sub);
    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toNumber(),
      discount: discount.toNumber(),
      total: sub.minus(discount).toNumber(),
    };
  }

  /** Marks one use inside the order transaction. */
  async consume(tx: Tx, couponId: string) {
    await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
  }

  /** Gives a use back when an order that used the coupon is cancelled. */
  async release(tx: Tx, couponId: string | null) {
    if (!couponId) return;
    await tx.coupon.updateMany({
      where: { id: couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  // ---------------------------------------------------------------- admin

  async list() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: { discountAmount: true },
        },
      },
    });
    return coupons.map((c) => ({
      ...this.toDto(c),
      totalDiscount: c.orders.reduce((n, o) => n + o.discountAmount.toNumber(), 0),
    }));
  }

  async create(dto: CreateCouponDto) {
    this.assertValue(dto.type, dto.value);
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Coupon "${dto.code}" already exists`);
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minOrder: dto.minOrder != null ? new Prisma.Decimal(dto.minOrder) : null,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? endOfDay(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toDto(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    this.assertValue(dto.type ?? coupon.type, dto.value ?? coupon.value.toNumber());
    if (dto.code && dto.code !== coupon.code) {
      const clash = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
      if (clash) throw new ConflictException(`Coupon "${dto.code}" already exists`);
    }
    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: new Prisma.Decimal(dto.value) }),
        // null clears a limit; undefined leaves it unchanged
        ...(dto.minOrder !== undefined && {
          minOrder: dto.minOrder === null ? null : new Prisma.Decimal(dto.minOrder),
        }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt === null ? null : endOfDay(dto.expiresAt),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toDto(updated);
  }

  /** Unused coupons are deleted; used ones are only deactivated so order history keeps its code. */
  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.usedCount > 0) {
      const updated = await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, coupon: this.toDto(updated) };
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  private assertValue(type: DiscountType, value: number) {
    if (type === DiscountType.PERCENT && value > 100) {
      throw new BadRequestException('A percent discount cannot exceed 100');
    }
  }

  private toDto(c: Coupon) {
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value.toNumber(),
      minOrder: c.minOrder ? c.minOrder.toNumber() : null,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      isActive: c.isActive,
      createdAt: c.createdAt,
    };
  }
}

/** A date-only expiry ("2026-12-31") stays valid for that whole day (UTC). */
function endOfDay(date: string) {
  const d = new Date(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) d.setUTCHours(23, 59, 59, 999);
  return d;
}
