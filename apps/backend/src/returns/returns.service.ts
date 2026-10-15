import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReturnDto, UpdateReturnDto } from './dto/return.dto.js';

/** Allowed admin decisions on a return request. */
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
  [ReturnStatus.APPROVED]: [ReturnStatus.REFUNDED, ReturnStatus.REJECTED],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.REFUNDED]: [],
};

const OPEN: ReturnStatus[] = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED];

const ADMIN_RETURN_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  order: {
    select: {
      id: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
        },
      },
    },
  },
} as const;

type AdminReturn = Prisma.ReturnRequestGetPayload<{ include: typeof ADMIN_RETURN_INCLUDE }>;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Customer asks to return a delivered order; one open request per order. */
  async create(userId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }
    const open = await this.prisma.returnRequest.findFirst({
      where: { orderId: order.id, status: { in: OPEN } },
    });
    if (open) throw new ConflictException('A return request for this order is already open');
    const refunded = await this.prisma.returnRequest.findFirst({
      where: { orderId: order.id, status: ReturnStatus.REFUNDED },
    });
    if (refunded) throw new ConflictException('This order has already been refunded');

    const created = await this.prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId,
        reason: dto.reason.trim(),
        details: dto.details?.trim() || null,
      },
    });
    return { id: created.id, status: created.status };
  }

  async mine(userId: string) {
    const rows = await this.prisma.returnRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      status: r.status,
      reason: r.reason,
      refundAmount: r.refundAmount?.toNumber() ?? null,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
    }));
  }

  // ---------------------------------------------------------------- admin

  async list(status?: ReturnStatus) {
    const rows = await this.prisma.returnRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ADMIN_RETURN_INCLUDE,
    });
    return rows.map((r) => this.toAdminDto(r));
  }

  /**
   * Admin decision. Refunding puts the order's items back into stock and
   * records the refund (default: full order total).
   */
  async update(id: string, dto: UpdateReturnDto) {
    const request = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true } } },
    });
    if (!request) throw new NotFoundException('Return request not found');
    if (!TRANSITIONS[request.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot move a return from ${request.status} to ${dto.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === ReturnStatus.REFUNDED) {
        for (const item of request.order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      const refund =
        dto.status === ReturnStatus.REFUNDED
          ? new Prisma.Decimal(dto.refundAmount ?? request.order.totalAmount.toNumber())
          : undefined;
      if (refund && refund.gt(request.order.totalAmount)) {
        throw new BadRequestException('Refund cannot be more than the order total');
      }
      return tx.returnRequest.update({
        where: { id },
        data: {
          status: dto.status,
          ...(refund !== undefined && { refundAmount: refund }),
          ...(dto.adminNote !== undefined && { adminNote: dto.adminNote.trim() || null }),
        },
        include: ADMIN_RETURN_INCLUDE,
      });
    });
    return this.toAdminDto(updated);
  }

  private toAdminDto(r: AdminReturn) {
    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      details: r.details,
      refundAmount: r.refundAmount?.toNumber() ?? null,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: r.user,
      order: {
        id: r.order.id,
        totalAmount: r.order.totalAmount.toNumber(),
        createdAt: r.order.createdAt,
        items: r.order.items.map((i) => ({
          productId: i.productId,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toNumber(),
        })),
      },
    };
  }
}
