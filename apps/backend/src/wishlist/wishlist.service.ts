import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  comparePrice: true,
  imageUrl: true,
  stock: true,
  isActive: true,
} as const;

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: { product: { select: typeof PRODUCT_SELECT } };
}>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: PRODUCT_SELECT } },
    });
    return items.map((item) => this.toDto(item));
  }

  async toggle(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product "${productId}" not found`);
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      await this.prisma.wishlistItem.delete({
        where: { userId_productId: { userId, productId } },
      });
      return { wishlisted: false as const, productId };
    }
    await this.prisma.wishlistItem.create({
      data: { userId, productId },
    });
    return { wishlisted: true as const, productId };
  }

  async remove(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) {
      throw new NotFoundException('Item not found in wishlist');
    }
    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });
    return { wishlisted: false as const, productId };
  }

  private toDto(item: WishlistItemWithProduct) {
    const price = item.product.price.toNumber();
    const comparePrice = item.product.comparePrice?.toNumber() ?? null;
    return {
      productId: item.productId,
      createdAt: item.createdAt,
      product: { ...item.product, price, comparePrice },
    };
  }
}
