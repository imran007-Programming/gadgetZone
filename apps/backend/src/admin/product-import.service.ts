import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { CloudinaryService, type UploadedImage } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_ROWS = 500;

export interface BulkImportResult {
  created: number;
  failed: { row: number; name: string; error: string }[];
}

/**
 * CSV columns (header row required):
 *   name, slug (optional), description, price, comparePrice (optional),
 *   stock, category (category slug), isActive (optional, default true),
 *   images (pipe-separated: image file names from the upload, or https URLs)
 *
 * Each row becomes one product with a gallery. Rows are processed one by one,
 * so a bad row is reported and the rest of the file still imports.
 */
@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async importCsv(
    csv: Express.Multer.File | undefined,
    imageFiles: Express.Multer.File[] = [],
  ): Promise<BulkImportResult> {
    if (!csv) {
      throw new BadRequestException('Attach the CSV file in the "csv" field');
    }

    let rows: Record<string, string>[];
    try {
      rows = parse(csv.buffer, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (err) {
      throw new BadRequestException(`Invalid CSV: ${(err as Error).message}`);
    }
    if (rows.length === 0) {
      throw new BadRequestException('CSV has no product rows');
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`Max ${MAX_ROWS} rows per import (got ${rows.length})`);
    }

    const categories = await this.prisma.category.findMany({
      select: { id: true, slug: true },
    });
    const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
    // Brand column accepts the slug or the name, case-insensitive
    const brands = await this.prisma.brand.findMany({ select: { id: true, slug: true, name: true } });
    const brandIdByKey = new Map<string, string>();
    for (const b of brands) {
      brandIdByKey.set(b.slug.toLowerCase(), b.id);
      brandIdByKey.set(b.name.toLowerCase(), b.id);
    }
    const filesByName = new Map(
      imageFiles.map((f) => [f.originalname.trim().toLowerCase(), f]),
    );

    const result: BulkImportResult = { created: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Header is line 1, so data row i is line i + 2.
      const line = i + 2;
      const name = row.name ?? '';
      const uploaded: UploadedImage[] = [];

      try {
        const data = await this.validateRow(row, categoryIdBySlug, brandIdByKey);
        const folder = `gadgetlax/products/${data.slug}`;

        for (const ref of data.imageRefs) {
          uploaded.push(await this.resolveImage(ref, filesByName, folder));
        }

        await this.prisma.product.create({
          data: {
            name: data.name,
            slug: data.slug,
            description: data.description,
            price: new Prisma.Decimal(data.price),
            comparePrice:
              data.comparePrice !== undefined
                ? new Prisma.Decimal(data.comparePrice)
                : undefined,
            stock: data.stock,
            isActive: data.isActive,
            categoryId: data.categoryId,
            brandId: data.brandId,
            imageUrl: uploaded[0].url,
            images: {
              create: uploaded.map((img, position) => ({
                url: img.url,
                publicId: img.publicId,
                position,
              })),
            },
          },
        });
        result.created++;
      } catch (err) {
        // Don't leave orphaned images in Cloudinary for a row that failed.
        await Promise.allSettled(uploaded.map((img) => this.cloudinary.destroy(img.publicId)));
        result.failed.push({
          row: line,
          name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  private async validateRow(
    row: Record<string, string>,
    categoryIdBySlug: Map<string, string>,
    brandIdByKey: Map<string, string>,
  ) {
    const name = required(row, 'name');
    const description = required(row, 'description');
    const price = positiveNumber(row, 'price');
    const comparePrice = optionalNumber(row, 'compareprice');
    const stock = nonNegativeInt(row, 'stock');

    const categorySlug = required(row, 'category');
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) {
      throw new Error(`Unknown category "${categorySlug}"`);
    }

    const brandKey = (row.brand ?? '').trim().toLowerCase();
    const brandId = brandKey ? brandIdByKey.get(brandKey) : undefined;
    if (brandKey && !brandId) {
      throw new Error(`Unknown brand "${row.brand}"`);
    }

    const slug = (row.slug || slugify(name)).toLowerCase();
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`Slug "${slug}" already exists`);
    }

    if (comparePrice !== undefined && comparePrice <= price) {
      throw new Error('comparePrice must be greater than price');
    }

    const imageRefs = (row.images ?? '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (imageRefs.length === 0) {
      throw new Error('At least one image is required (column "images")');
    }

    const isActive = !['false', '0', 'no'].includes((row.isactive ?? '').toLowerCase());

    return {
      name,
      slug,
      description,
      price,
      comparePrice,
      stock,
      categoryId,
      brandId: brandId ?? null,
      isActive,
      imageRefs,
    };
  }

  private async resolveImage(
    ref: string,
    filesByName: Map<string, Express.Multer.File>,
    folder: string,
  ): Promise<UploadedImage> {
    if (/^https?:\/\//i.test(ref)) {
      return this.cloudinary.uploadRemote(ref, folder);
    }
    const file = filesByName.get(ref.toLowerCase());
    if (!file) {
      throw new Error(`Image file "${ref}" was not included in the upload`);
    }
    return this.cloudinary.uploadBuffer(file.buffer, folder);
  }
}

function required(row: Record<string, string>, key: string): string {
  const value = (row[key] ?? '').trim();
  if (!value) throw new Error(`Missing "${key}"`);
  return value;
}

function positiveNumber(row: Record<string, string>, key: string): number {
  const n = Number(required(row, key));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`"${key}" must be a positive number`);
  return n;
}

function optionalNumber(row: Record<string, string>, key: string): number | undefined {
  const raw = (row[key] ?? '').trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`"${key}" must be a positive number`);
  return n;
}

function nonNegativeInt(row: Record<string, string>, key: string): number {
  const n = Number(required(row, key));
  if (!Number.isInteger(n) || n < 0) throw new Error(`"${key}" must be a whole number ≥ 0`);
  return n;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
