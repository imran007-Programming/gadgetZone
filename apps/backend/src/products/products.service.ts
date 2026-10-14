import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto.js';

const CATEGORY_SELECT = { id: true, name: true, slug: true } as const;

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: { select: typeof CATEGORY_SELECT } };
}>;

/**
 * Money handling choice: prices are Decimal(10,2) in the DB. All writes keep
 * full Decimal precision; every read response converts Decimals to JS numbers
 * via toNumber(). Safe for this demo's price ranges; a real storefront would
 * use integer cents end-to-end instead.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductsDto) {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sort = ProductSort.Newest,
    } = query;

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.category = { slug: category };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = new Prisma.Decimal(minPrice);
      }
      if (maxPrice !== undefined) {
        where.price.lte = new Prisma.Decimal(maxPrice);
      }
    }
    if (inStock) {
      where.stock = { gt: 0 };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === ProductSort.PriceAsc
        ? { price: 'asc' }
        : sort === ProductSort.PriceDesc
          ? { price: 'desc' }
          : sort === ProductSort.Name
            ? { name: 'asc' }
            : { createdAt: 'desc' };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: CATEGORY_SELECT } },
      }),
    ]);

    return {
      items: products.map((p) => this.toProductDto(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: { category: { select: CATEGORY_SELECT } },
    });
    if (!product) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return this.toProductDto(product);
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
}
