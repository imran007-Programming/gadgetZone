import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto.js';

const BANNER_FOLDER = 'gadgetlax/banners';

const BANNER_INCLUDE = {
  product: { select: { id: true, name: true, slug: true, imageUrl: true, isActive: true } },
} as const;

type BannerWithProduct = Prisma.BannerGetPayload<{ include: typeof BANNER_INCLUDE }>;

/** Where a click goes: the linked product while it is active, otherwise the custom link. */
function bannerHref(b: BannerWithProduct) {
  if (b.product?.isActive) return `/products/${b.product.slug}`;
  return b.ctaHref;
}

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Storefront: active banners whose schedule (if any) covers now, in display order. */
  async publicList() {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { position: 'asc' },
      include: BANNER_INCLUDE,
    });
    return banners.map((b) => ({
      id: b.id,
      title: b.title,
      imageUrl: b.imageUrl,
      href: bannerHref(b),
    }));
  }

  // ---------------------------------------------------------------- admin

  async list() {
    const banners = await this.prisma.banner.findMany({ orderBy: { position: 'asc' }, include: BANNER_INCLUDE });
    return banners.map((b) => this.toDto(b));
  }

  /** Stores a banner image on Cloudinary; the banner is saved separately with the returned URL. */
  async uploadImage(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Attach an image in the "image" field');
    return this.cloudinary.uploadBuffer(file.buffer, BANNER_FOLDER);
  }

  async create(dto: CreateBannerDto) {
    this.assertSchedule(dto.startsAt, dto.endsAt);
    await this.assertProduct(dto.productId);
    const last = await this.prisma.banner.findFirst({ orderBy: { position: 'desc' } });
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        productId: dto.productId || null,
        ctaHref: clean(dto.ctaHref),
        imageUrl: dto.imageUrl,
        publicId: dto.publicId ?? null,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? endOfDay(dto.endsAt) : null,
        // New banners go to the end of the carousel
        position: (last?.position ?? -1) + 1,
      },
      include: BANNER_INCLUDE,
    });
    return this.toDto(banner);
  }

  async update(id: string, dto: UpdateBannerDto) {
    const banner = await this.findOrThrow(id);
    const startsAt = dto.startsAt !== undefined ? dto.startsAt : banner.startsAt?.toISOString() ?? null;
    const endsAt = dto.endsAt !== undefined ? dto.endsAt : banner.endsAt?.toISOString() ?? null;
    this.assertSchedule(startsAt, endsAt);
    await this.assertProduct(dto.productId);

    const updated = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.productId !== undefined && { productId: dto.productId || null }),
        ...(dto.ctaHref !== undefined && { ctaHref: clean(dto.ctaHref) }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl, publicId: dto.publicId ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }),
        ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? endOfDay(dto.endsAt) : null }),
      },
      include: BANNER_INCLUDE,
    });

    // The old image is no longer used once a new one replaced it
    if (dto.imageUrl !== undefined && banner.publicId && banner.publicId !== updated.publicId) {
      await this.destroyQuietly(banner.publicId);
    }
    return this.toDto(updated);
  }

  async remove(id: string) {
    const banner = await this.findOrThrow(id);
    await this.prisma.banner.delete({ where: { id } });
    if (banner.publicId) await this.destroyQuietly(banner.publicId);
    return { deleted: true };
  }

  /** Saves a new display order; ids must be exactly the existing banners. */
  async reorder(ids: string[]) {
    const existing = await this.prisma.banner.findMany({ select: { id: true } });
    const known = new Set(existing.map((b) => b.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new BadRequestException('Send every banner id exactly once');
    }
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.banner.update({ where: { id }, data: { position } })),
    );
    return this.list();
  }

  private async findOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  private async assertProduct(productId?: string | null) {
    if (!productId) return;
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new BadRequestException('Linked product not found');
  }

  private assertSchedule(startsAt?: string | null, endsAt?: string | null) {
    if (startsAt && endsAt && endOfDay(endsAt) < new Date(startsAt)) {
      throw new BadRequestException('End date must be on or after the start date');
    }
  }

  /** Cloudinary cleanup must never block the banner change itself. */
  private async destroyQuietly(publicId: string) {
    try {
      await this.cloudinary.destroy(publicId);
    } catch (err) {
      this.logger.warn(`Could not delete Cloudinary image ${publicId}: ${String(err)}`);
    }
  }

  private toDto(b: BannerWithProduct) {
    return {
      id: b.id,
      title: b.title,
      productId: b.productId,
      product: b.product,
      ctaHref: b.ctaHref,
      href: bannerHref(b),
      imageUrl: b.imageUrl,
      isActive: b.isActive,
      position: b.position,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }
}

/** Empty strings become null so optional text can be cleared. */
function clean(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : null;
}

/** A date-only end ("2026-11-15") keeps the banner live for that whole day (UTC). */
function endOfDay(date: string) {
  const d = new Date(date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) d.setUTCHours(23, 59, 59, 999);
  return d;
}
