/**
 * Copies the catalog from the local database to the live one: brands (with
 * logos/covers), categories and subcategories (parent + display order),
 * products with their galleries, the product a banner links to, and the
 * storefront settings (top bar). Images are not re-uploaded; both databases point at the same
 * Cloudinary files.
 *
 * Live products that are not in the local catalog are deleted, except ones
 * referenced by an order, which are only deactivated so order history stays intact.
 *
 * Source: DATABASE_URL. Target: LIVE_DATABASE_URL (both from apps/backend/.env).
 * Dry run by default; pass --apply to write.
 *
 *   npx tsx prisma/sync-to-live.ts           # report only
 *   npx tsx prisma/sync-to-live.ts --apply   # write to the live database
 */
import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile();
} catch {
  // rely on the environment
}

const { DATABASE_URL, LIVE_DATABASE_URL } = process.env;
if (!DATABASE_URL || !LIVE_DATABASE_URL) {
  console.error('Set DATABASE_URL (local) and LIVE_DATABASE_URL (live) in apps/backend/.env');
  process.exit(1);
}
if (DATABASE_URL === LIVE_DATABASE_URL) {
  console.error('DATABASE_URL and LIVE_DATABASE_URL are the same database; refusing to run.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const local = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const live = new PrismaClient({ datasources: { db: { url: LIVE_DATABASE_URL } } });

const hostOf = (url: string) => url.replace(/^.*@/, '').replace(/\/.*$/, '');

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${hostOf(DATABASE_URL!)} → ${hostOf(LIVE_DATABASE_URL!)}`);

  const [brands, categories, products, banners, settings] = await Promise.all([
    local.brand.findMany(),
    local.category.findMany({ include: { parent: { select: { slug: true } } } }),
    local.product.findMany({
      include: { images: { orderBy: { position: 'asc' } }, brand: true, category: true },
    }),
    local.banner.findMany({ include: { product: { select: { slug: true } } } }),
    local.siteSetting.findUnique({ where: { id: 'default' } }),
  ]);
  const keepSlugs = new Set(products.map((p) => p.slug));

  const liveProducts = await live.product.findMany({
    select: { id: true, slug: true, _count: { select: { orderItems: true } } },
  });
  const stale = liveProducts.filter((p) => !keepSlugs.has(p.slug));
  const toDeactivate = stale.filter((p) => p._count.orderItems > 0);
  const toDelete = stale.filter((p) => p._count.orderItems === 0);

  const subCount = categories.filter((c) => c.parentId).length;
  console.log(
    `local: ${brands.length} brands, ${categories.length - subCount} categories + ${subCount} subcategories, ${products.length} products, ${banners.length} banners, settings ${settings ? 'yes' : 'no'}`,
  );
  console.log(`live:  ${liveProducts.length} products → delete ${toDelete.length}, deactivate ${toDeactivate.length} (have orders), upsert ${products.length}`);
  if (!APPLY) {
    console.log('Nothing written. Re-run with --apply to sync.');
    return;
  }

  // Brands and categories first, keyed by slug
  const brandId = new Map<string, string>();
  for (const b of brands) {
    const data = {
      name: b.name,
      description: b.description,
      logoUrl: b.logoUrl,
      logoPublicId: b.logoPublicId,
      bannerUrl: b.bannerUrl,
      bannerPublicId: b.bannerPublicId,
      isActive: b.isActive,
    };
    const row = await live.brand.upsert({ where: { slug: b.slug }, create: { slug: b.slug, ...data }, update: data });
    brandId.set(b.slug, row.id);
  }
  // Categories in two passes: every row first, then each subcategory's parent by slug
  const categoryId = new Map<string, string>();
  for (const c of categories) {
    const data = { name: c.name, description: c.description, position: c.position };
    const row = await live.category.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
    categoryId.set(c.slug, row.id);
  }
  for (const c of categories) {
    await live.category.update({
      where: { slug: c.slug },
      data: { parentId: c.parent ? (categoryId.get(c.parent.slug) ?? null) : null },
    });
  }
  console.log(`brands + categories synced`);

  // Old products: delete when safe, otherwise hide
  if (toDelete.length) {
    await live.product.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
  }
  if (toDeactivate.length) {
    await live.product.updateMany({ where: { id: { in: toDeactivate.map((p) => p.id) } }, data: { isActive: false } });
  }
  console.log(`old products: ${toDelete.length} deleted, ${toDeactivate.length} deactivated`);

  // Local catalog, gallery replaced each time
  const productId = new Map<string, string>();
  for (const p of products) {
    const data = {
      name: p.name,
      description: p.description,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      categoryId: categoryId.get(p.category.slug)!,
      brandId: p.brand ? (brandId.get(p.brand.slug) ?? null) : null,
    };
    const row = await live.$transaction(async (tx) => {
      const saved = await tx.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
      await tx.productImage.deleteMany({ where: { productId: saved.id } });
      if (p.images.length) {
        await tx.productImage.createMany({
          data: p.images.map((img) => ({ productId: saved.id, url: img.url, publicId: img.publicId, position: img.position })),
        });
      }
      return saved;
    });
    productId.set(p.slug, row.id);
  }
  console.log(`products synced: ${products.length}`);

  // Banners: same image/title per position, pointing at the live copy of the product
  const liveBanners = await live.banner.findMany({ orderBy: { position: 'asc' } });
  let bannerCount = 0;
  for (const b of banners) {
    const target = liveBanners.find((lb) => lb.imageUrl === b.imageUrl && lb.position === b.position);
    const data = {
      title: b.title,
      productId: b.product ? (productId.get(b.product.slug) ?? null) : null,
      ctaHref: b.ctaHref,
      imageUrl: b.imageUrl,
      publicId: b.publicId,
      position: b.position,
      isActive: b.isActive,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    };
    if (target) await live.banner.update({ where: { id: target.id }, data });
    else await live.banner.create({ data });
    bannerCount++;
  }
  console.log(`banners synced: ${bannerCount}`);

  if (settings) {
    const { id, updatedAt, ...data } = settings;
    void updatedAt;
    await live.siteSetting.upsert({ where: { id }, create: { id, ...data }, update: data });
    console.log('settings synced (top bar)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([local.$disconnect(), live.$disconnect()]);
  });
