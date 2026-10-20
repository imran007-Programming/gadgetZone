import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

/** Sort column per option; id breaks ties so every product has one fixed position. */
const SORT_KEYS = {
  [ProductSort.Newest]: { field: 'createdAt', dir: 'desc' },
  [ProductSort.PriceAsc]: { field: 'price', dir: 'asc' },
  [ProductSort.PriceDesc]: { field: 'price', dir: 'desc' },
  [ProductSort.Name]: { field: 'name', dir: 'asc' },
} as const;

type SortKey = (typeof SORT_KEYS)[ProductSort];

/** Cursor payload: the last product's sort value (as a string) and its id. */
interface ProductCursor {
  v: string;
  id: string;
}

function encodeCursor(product: ProductWithRelations, key: SortKey): string {
  const value = product[key.field];
  const v = value instanceof Date ? value.toISOString() : value.toString();
  return Buffer.from(JSON.stringify({ v, id: product.id } satisfies ProductCursor)).toString('base64url');
}

function decodeCursor(raw: string): ProductCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<ProductCursor>;
    if (typeof parsed.v === 'string' && typeof parsed.id === 'string') return { v: parsed.v, id: parsed.id };
  } catch {
    // fall through
  }
  throw new BadRequestException('Invalid cursor');
}

/**
 * Keyset condition for "after the cursor" in the given order:
 * (sort > v) OR (sort = v AND id > cursorId), with < for descending sorts.
 */
function afterCursor(cursor: ProductCursor, key: SortKey): Prisma.ProductWhereInput {
  const op = key.dir === 'asc' ? 'gt' : 'lt';
  let value: Date | Prisma.Decimal | string = cursor.v;
  if (key.field === 'createdAt') {
    value = new Date(cursor.v);
    if (Number.isNaN(value.getTime())) throw new BadRequestException('Invalid cursor');
  } else if (key.field === 'price') {
    try {
      value = new Prisma.Decimal(cursor.v);
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }
  return {
    OR: [{ [key.field]: { [op]: value } }, { [key.field]: value, id: { [op]: cursor.id } }],
  };
}

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
      cursor,
    } = query;

    const where: Prisma.ProductWhereInput = { isActive: true };
    // Every word must appear somewhere: name, brand, category or description
    // ("sony headphones", "smart watch", "audio" all find something)
    const terms = (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    if (terms.length) {
      // Brand and category names are matched in their own small tables first. That keeps
      // every condition below on Product's own columns: name and description hit the
      // trigram indexes, brandId and categoryId their b-tree indexes. Filtering through the
      // relations instead makes Postgres scan every product, whatever the indexes.
      const anyTerm = { OR: terms.map((term) => ({ name: { contains: term, mode: 'insensitive' as const } })) };
      const [brands, categories] = await Promise.all([
        this.prisma.brand.findMany({ where: anyTerm, select: { id: true, name: true } }),
        this.prisma.category.findMany({ where: anyTerm, select: { id: true, name: true } }),
      ]);
      const idsMatching = (rows: { id: string; name: string }[], term: string) =>
        rows.filter((r) => r.name.toLowerCase().includes(term.toLowerCase())).map((r) => r.id);

      where.AND = terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { brandId: { in: idsMatching(brands, term) } },
          { categoryId: { in: idsMatching(categories, term) } },
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

    const key = SORT_KEYS[sort] ?? SORT_KEYS[ProductSort.Newest];
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [key.field]: key.dir },
      { id: key.dir },
    ];

    // With a cursor, continue right after it (keyset, so deep pages stay fast and nothing
    // shifts when products are added); without one, fall back to page/offset.
    const listWhere = cursor ? { AND: [where, afterCursor(decodeCursor(cursor), key)] } : where;

    // Run in parallel: an array $transaction sends BEGIN, both queries and COMMIT one
    // after another, and the total only feeds the pager, so it needs no shared snapshot.
    // One extra row tells whether another batch exists.
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where: listWhere,
        orderBy,
        skip: cursor ? 0 : (page - 1) * limit,
        take: limit + 1,
        include: PRODUCT_INCLUDE,
      }),
    ]);
    const products = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    return {
      items: products.map((p) => this.toProductDto(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: hasMore ? encodeCursor(products[products.length - 1], key) : null,
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
