import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  imageUrl: true,
  stock: true,
  isActive: true,
} as const;

type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: { product: { select: typeof PRODUCT_SELECT } };
}>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { product: { name: 'asc' } },
      include: { product: { select: PRODUCT_SELECT } },
    });
    return this.toCartDto(items);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product "${dto.productId}" not found`);
    }
    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is not available`,
      );
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
    });
    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (newQuantity > product.stock) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${newQuantity})`,
      );
    }

    await this.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: { userId, productId: dto.productId, quantity: dto.quantity },
      update: { quantity: newQuantity },
    });
    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { product: true },
    });
    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }
    if (quantity > item.product.stock) {
      throw new BadRequestException(
        `Insufficient stock for "${item.product.name}" (available: ${item.product.stock}, requested: ${quantity})`,
      );
    }
    await this.prisma.cartItem.update({
      where: { userId_productId: { userId, productId } },
      data: { quantity },
    });
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }
    await this.prisma.cartItem.delete({
      where: { userId_productId: { userId, productId } },
    });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return this.getCart(userId);
  }

  private toCartDto(items: CartItemWithProduct[]) {
    const mapped = items.map((item) => {
      const price = item.product.price.toNumber();
      return {
        productId: item.productId,
        quantity: item.quantity,
        lineTotal: price * item.quantity,
        product: { ...item.product, price },
      };
    });
    return {
      items: mapped,
      subtotal: mapped.reduce((sum, i) => sum + i.lineTotal, 0),
      itemCount: mapped.reduce((sum, i) => sum + i.quantity, 0),
    };
  }
}
