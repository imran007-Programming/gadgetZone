import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReviewDto, ModerateReviewDto } from './dto/review.dto.js';

const ADMIN_REVIEW_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  product: { select: { id: true, name: true, slug: true, imageUrl: true } },
} as const;

type AdminReview = Prisma.ReviewGetPayload<{ include: typeof ADMIN_REVIEW_INCLUDE }>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Approved reviews for the product page, with the rating summary. */
  async forProduct(productId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length,
    }));
    const average = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
    return {
      average: Math.round(average * 10) / 10,
      count: reviews.length,
      distribution,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply,
        createdAt: r.createdAt,
        // First name + initial only on the public page
        author: shortName(r.user.name),
      })),
    };
  }

  /** Whether this customer may review the product (verified, delivered purchase, no review yet). */
  async eligibility(userId: string, productId: string) {
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      return { canReview: false, reason: 'You have already reviewed this product', status: existing.status };
    }
    const delivered = await this.hasDeliveredPurchase(userId, productId);
    return delivered
      ? { canReview: true }
      : { canReview: false, reason: 'Only customers who received this product can review it' };
  }

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!(await this.hasDeliveredPurchase(userId, dto.productId))) {
      throw new ForbiddenException('Only customers who received this product can review it');
    }
    try {
      const review = await this.prisma.review.create({
        data: {
          productId: dto.productId,
          userId,
          rating: dto.rating,
          comment: dto.comment.trim(),
        },
      });
      return { id: review.id, status: review.status };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You have already reviewed this product');
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------- admin

  async list(status?: ReviewStatus) {
    const reviews = await this.prisma.review.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ADMIN_REVIEW_INCLUDE,
    });
    return reviews.map((r) => this.toAdminDto(r));
  }

  async moderate(id: string, dto: ModerateReviewDto) {
    if (dto.status === undefined && dto.reply === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    const reply = dto.reply?.trim();
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.reply !== undefined && {
          reply: reply || null,
          repliedAt: reply ? new Date() : null,
        }),
      },
      include: ADMIN_REVIEW_INCLUDE,
    });
    return this.toAdminDto(updated);
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }

  private async hasDeliveredPurchase(userId: string, productId: string) {
    const count = await this.prisma.orderItem.count({
      where: { productId, order: { userId, status: OrderStatus.DELIVERED } },
    });
    return count > 0;
  }

  private toAdminDto(r: AdminReview) {
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      reply: r.reply,
      repliedAt: r.repliedAt,
      createdAt: r.createdAt,
      user: r.user,
      product: r.product,
    };
  }
}

function shortName(name: string) {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}
