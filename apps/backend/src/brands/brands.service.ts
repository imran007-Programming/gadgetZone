import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Brand } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';

const LOGO_FOLDER = 'gadgetlax/brands';

type BrandWithCount = Brand & { _count: { products: number } };

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Storefront: active brands with their number of active products, A–Z.
   * With a category slug, only brands that have products in that category are
   * returned, and the counts cover that category only.
   */
  async publicList(categorySlug?: string) {
    const productWhere = {
      isActive: true,
      ...(categorySlug && { category: { slug: categorySlug } }),
    };
    const brands = await this.prisma.brand.findMany({
      where: {
        isActive: true,
        ...(categorySlug && { products: { some: productWhere } }),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: productWhere } } } },
    });
    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: b.logoUrl,
      bannerUrl: b.bannerUrl,
      productCount: b._count.products,
    }));
  }

  /** Storefront brand page header; hidden brands are not found. */
  async publicBySlug(slug: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, isActive: true },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    if (!brand) throw new NotFoundException(`Brand "${slug}" not found`);
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      bannerUrl: brand.bannerUrl,
      productCount: brand._count.products,
    };
  }

  // ---------------------------------------------------------------- admin

  async list() {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return brands.map((b) => this.toDto(b));
  }

  async uploadLogo(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Attach an image in the "image" field');
    return this.cloudinary.uploadBuffer(file.buffer, LOGO_FOLDER);
  }

  async create(dto: CreateBrandDto) {
    await this.assertSlugFree(dto.slug);
    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug,
        description: dto.description?.trim() || null,
        logoUrl: dto.logoUrl ?? null,
        logoPublicId: dto.logoPublicId ?? null,
        bannerUrl: dto.bannerUrl ?? null,
        bannerPublicId: dto.bannerPublicId ?? null,
        isActive: dto.isActive ?? true,
      },
      include: { _count: { select: { products: true } } },
    });
    return this.toDto(brand);
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brand = await this.findOrThrow(id);
    if (dto.slug && dto.slug !== brand.slug) await this.assertSlugFree(dto.slug);
    const updated = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl, logoPublicId: dto.logoPublicId ?? null }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl, bannerPublicId: dto.bannerPublicId ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { products: true } } },
    });
    // Old logo is unused once replaced or removed
    if (dto.logoUrl !== undefined && brand.logoPublicId && brand.logoPublicId !== updated.logoPublicId) {
      await this.destroyQuietly(brand.logoPublicId);
    }
    if (dto.bannerUrl !== undefined && brand.bannerPublicId && brand.bannerPublicId !== updated.bannerPublicId) {
      await this.destroyQuietly(brand.bannerPublicId);
    }
    return this.toDto(updated);
  }

  /** Products keep existing; they just lose their brand (FK is SET NULL). */
  async remove(id: string) {
    const brand = await this.findOrThrow(id);
    await this.prisma.brand.delete({ where: { id } });
    if (brand.logoPublicId) await this.destroyQuietly(brand.logoPublicId);
    if (brand.bannerPublicId) await this.destroyQuietly(brand.bannerPublicId);
    return { deleted: true };
  }

  private async findOrThrow(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  private async assertSlugFree(slug: string) {
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Brand slug "${slug}" is already taken`);
  }

  private async destroyQuietly(publicId: string) {
    try {
      await this.cloudinary.destroy(publicId);
    } catch (err) {
      this.logger.warn(`Could not delete Cloudinary image ${publicId}: ${String(err)}`);
    }
  }

  private toDto(b: BrandWithCount) {
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logoUrl: b.logoUrl,
      bannerUrl: b.bannerUrl,
      isActive: b.isActive,
      productCount: b._count.products,
      createdAt: b.createdAt,
    };
  }
}
