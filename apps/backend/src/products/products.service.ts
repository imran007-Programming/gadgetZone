import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto.js';

const CATEGORY_SELECT = { id: true, name: true, slug: true, parentId: true } as const;

/** Category plus the gallery, ordered for display. */
const PRODUCT_INCLUDE = {
  category: { select: CATEGORY_SELECT },
  images: { orderBy: { position: "asc" } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
} as const;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
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
      page,
      limit,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      sort,
    } = query;

    const where: Prisma.ProductWhereInput = { isActive: true };
    // Every word must appear somewhere: name, brand, category or description
    // ("sony headphones", "smart watch", "audio" all find something)
    const terms = (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    if (terms.length) {
      where.AND = terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { brand: { name: { contains: term, mode: 'insensitive' } } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      }));
    }
    if (category) {
      // A top-level category also lists the products of its subcategories
      where.category = { OR: [{ slug: category }, { parent: { slug: category } }] };
    }
    const brandSlugs = brand?.split(",").map((b) => b.trim()).filter(Boolean) ?? [];
    if (brandSlugs.length) {
      where.brand = { slug: { in: brandSlugs } };
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
        include: PRODUCT_INCLUDE,
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
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return this.toProductDto(product);
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
      images: p.images.map((img) => ({ id: img.id, url: img.url, position: img.position })),
      isActive: p.isActive,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category,
      brandId: p.brandId,
      brand: p.brand,
    };
  }
}
