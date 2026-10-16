/**
 * Dev-only: fills product galleries with sample photos from Wikimedia Commons.
 *
 * For each product without images it searches Commons by product name and keeps
 * only results whose title shares a keyword with the product name (no category
 * fallback, which made unrelated products share one photo). Up to 3 JPEG/PNG/WebP
 * results are fetched by Cloudinary straight into gadgetlax/products/<slug>.
 *
 * Commons files are openly licensed (mostly CC), but check attribution before a
 * real launch.
 *
 * Run with: npm run images:sample            (fill products without images)
 *           npm run images:sample -- --reset (delete all gallery images first)
 */
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { assertLocalDatabase } from './local-only.js';

try {
  process.loadEnvFile();
} catch {
  // rely on the environment
}

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('Cloudinary credentials are missing in apps/backend/.env');
  process.exit(1);
}
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');
if (RESET) assertLocalDatabase('images:sample --reset');
const PER_PRODUCT = 3;
const USER_AGENT = 'gadgetlax-seed/1.0 (local dev; contact: admin@example.com)';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STOPWORDS = new Set(['with', 'pro', 'mini', 'pack', 'wireless', 'smart', 'true', 'lite', 'plus']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CommonsHit {
  title: string;
  url: string;
}

/** Search Commons file pages and return usable hits (800px thumbnails). */
async function searchCommons(query: string): Promise<CommonsHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Commons search failed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    query?: {
      pages?: Record<string, { title: string; imageinfo?: { mime: string; thumburl?: string; url: string }[] }>;
    };
  };
  const hits: CommonsHit[] = [];
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info || !ALLOWED_MIME.has(info.mime)) continue;
    hits.push({ title: page.title.toLowerCase(), url: info.thumburl ?? info.url });
  }
  return hits;
}

/** Only keep Commons photos whose title contains a distinctive word from the product name. */
function keywordsFor(productName: string): string[] {
  return productName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

async function findImages(productName: string): Promise<string[]> {
  const keywords = keywordsFor(productName);
  if (keywords.length === 0) return [];
  const hits = await searchCommons(productName);
  return hits
    .filter((h) => keywords.some((k) => h.title.includes(k)))
    .slice(0, PER_PRODUCT)
    .map((h) => h.url);
}

async function uploadRemote(url: string, folder: string): Promise<{ url: string; publicId: string }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await cloudinary.uploader.upload(url, { folder, resource_type: 'image' });
      return { url: res.secure_url, publicId: res.public_id };
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(5000 * attempt);
    }
  }
  throw new Error('unreachable');
}

/** Remove every gallery image (Cloudinary asset and DB row) and clear product covers. */
async function resetGalleries() {
  const images = await prisma.productImage.findMany({ select: { id: true, publicId: true } });
  console.log(`Reset: deleting ${images.length} gallery images`);
  for (const img of images) {
    try {
      await cloudinary.uploader.destroy(img.publicId, { resource_type: 'image' });
    } catch (err) {
      console.log(`  could not delete ${img.publicId}: ${JSON.stringify(err)}`);
    }
    await sleep(100);
  }
  await prisma.productImage.deleteMany();
  await prisma.product.updateMany({ data: { imageUrl: '' } });
}

async function main() {
  if (RESET) await resetGalleries();

  const products = await prisma.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, name: true, slug: true },
    orderBy: { slug: 'asc' },
  });
  console.log(`Products without images: ${products.length}`);

  let done = 0;
  let imageCount = 0;
  const failed: string[] = [];

  for (const product of products) {
    try {
      const sources = await findImages(product.name);
      if (sources.length === 0) {
        failed.push(`${product.slug} (no matching photo)`);
        continue;
      }

      const folder = `gadgetlax/products/${product.slug}`;
      const uploaded: { url: string; publicId: string }[] = [];
      for (const src of sources) {
        uploaded.push(await uploadRemote(src, folder));
        await sleep(200);
      }

      await prisma.$transaction([
        prisma.productImage.createMany({
          data: uploaded.map((img, position) => ({
            productId: product.id,
            url: img.url,
            publicId: img.publicId,
            position,
          })),
        }),
        prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: uploaded[0].url },
        }),
      ]);

      done++;
      imageCount += uploaded.length;
      console.log(`✔ ${product.slug}: ${uploaded.length} image(s)`);
    } catch (err) {
      // Cloudinary rejects with plain objects, not Error instances, so read the message explicitly
      const reason = err instanceof Error ? err.message : JSON.stringify(err);
      failed.push(`${product.slug} (${reason})`);
      await sleep(5000);
    }
    await sleep(300);
  }

  console.log(`\nDone: ${done} products, ${imageCount} images uploaded.`);
  if (failed.length) {
    console.log(`Not filled (${failed.length}):`);
    for (const f of failed) console.log(`  - ${f}`);
  }
}

main()
  .catch((e) => {
    console.error('Sample image import failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
