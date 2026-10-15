/**
 * Dev-only: adds photos to the real-catalog products that still have none.
 * Uses the brand/series name for the search, so a photo may show an earlier
 * generation of the same product line. Only products with no images are touched.
 *
 * Run with: npm run catalog:gaps
 */
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

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
const USER_AGENT = 'gadgetlax-seed/1.0 (local dev; contact: admin@example.com)';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PER_PRODUCT = 3;

/** Search query and title keywords per product name (the name is the product in the DB). */
const GAPS: { name: string; query: string; match: string[] }[] = [
  { name: 'Sony WH-1000XM5 Wireless Headphones', query: 'Sony WH-1000XM3', match: ['wh-1000xm'] },
  { name: 'JBL Flip 6 Portable Bluetooth Speaker', query: 'JBL Flip speaker', match: ['jbl flip'] },
  { name: 'Fitbit Charge 6', query: 'Fitbit Charge', match: ['fitbit charge'] },
  { name: 'Anker 735 Charger (GaN, 65W)', query: 'Anker charger', match: ['anker'] },
  { name: 'Belkin BoostCharge Pro MagSafe Charger', query: 'Belkin MagSafe', match: ['belkin'] },
  { name: 'Amazon Echo Dot (5th Gen)', query: 'Echo Dot', match: ['echo dot'] },
  { name: 'Philips Hue White and Color Ambiance Bulb', query: 'Philips Hue', match: ['philips hue', 'hue'] },
  { name: 'Razer DeathAdder V3 Gaming Mouse', query: 'Razer DeathAdder', match: ['deathadder'] },
  { name: 'GoPro HERO12 Black', query: 'GoPro Hero', match: ['gopro'] },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findPhotos(query: string, match: string[]): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '15',
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
    query?: { pages?: Record<string, { title: string; imageinfo?: { mime: string; thumburl?: string; url: string }[] }> };
  };
  const urls: string[] = [];
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info || !ALLOWED_MIME.has(info.mime)) continue;
    const title = page.title.toLowerCase();
    if (match.some((m) => title.includes(m))) urls.push(info.thumburl ?? info.url);
  }
  return urls.slice(0, PER_PRODUCT);
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

async function main() {
  let filled = 0;
  const missing: string[] = [];

  for (const gap of GAPS) {
    const product = await prisma.product.findFirst({
      where: { name: gap.name, images: { none: {} } },
      select: { id: true, slug: true },
    });
    if (!product) continue; // already has photos, or not in the DB

    try {
      const sources = await findPhotos(gap.query, gap.match);
      if (sources.length === 0) {
        missing.push(gap.name);
        continue;
      }
      const uploaded: { url: string; publicId: string }[] = [];
      for (const src of sources) {
        try {
          uploaded.push(await uploadRemote(src, `gadgetlax/products/${product.slug}`));
        } catch {
          continue; // one rate-limited file should not block the others
        }
        await sleep(300);
      }
      if (uploaded.length === 0) {
        missing.push(`${gap.name} (every candidate photo failed to upload)`);
        continue;
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
        prisma.product.update({ where: { id: product.id }, data: { imageUrl: uploaded[0].url } }),
      ]);
      filled++;
      console.log(`✔ ${gap.name}: ${uploaded.length} photo(s)`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : JSON.stringify(err);
      missing.push(`${gap.name} (${reason})`);
      await sleep(3000);
    }
  }

  console.log(`\nFilled ${filled} product(s).`);
  if (missing.length) {
    console.log('Still no photo:');
    for (const m of missing) console.log(`  - ${m}`);
  }
}

main()
  .catch((e) => {
    console.error('Gap fill failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
