/**
 * Dev-only: replaces ALL products with a list of real, named gadgets and fills
 * each gallery with photos of those models from Wikimedia Commons.
 *
 * Safety: aborts before deleting anything if any order items exist.
 * Cloudinary assets from the old products are NOT deleted here (they stay in the
 * account as orphans and can be cleaned up separately).
 *
 * Run with: npm run catalog:real
 */
import { PrismaClient, Prisma } from '@prisma/client';
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

assertLocalDatabase('catalog:real');

const prisma = new PrismaClient();
const USER_AGENT = 'gadgetlax-seed/1.0 (local dev; contact: admin@example.com)';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PER_PRODUCT = 3;

interface RealProduct {
  name: string;
  category: string; // category slug
  description: string;
  price: number; // BDT, approximate retail price; edit in admin if needed
  comparePrice?: number;
  stock: number;
  /** Words that must appear in a Commons file title for the photo to count as this model. */
  match: string[];
}

const CATALOG: RealProduct[] = [
  { name: 'Sony WH-1000XM5 Wireless Headphones', category: 'audio', price: 38500, comparePrice: 42000, stock: 25,
    description: 'Industry-leading noise cancelling over-ear headphones with 30-hour battery life and crystal-clear calls.',
    match: ['wh-1000xm5', '1000xm5', 'xm5'] },
  { name: 'Apple AirPods Pro (2nd Generation)', category: 'audio', price: 32900, stock: 30,
    description: 'Active noise cancellation, adaptive transparency and personalised spatial audio in a compact case.',
    match: ['airpods pro', 'airpods'] },
  { name: 'JBL Flip 6 Portable Bluetooth Speaker', category: 'audio', price: 14500, comparePrice: 16000, stock: 40,
    description: 'Waterproof portable speaker with powerful JBL Pro Sound and up to 12 hours of playtime.',
    match: ['jbl flip', 'flip 6', 'jbl'] },
  { name: 'Apple Watch Series 9', category: 'wearables', price: 45000, stock: 18,
    description: 'Advanced health sensors, always-on Retina display and the faster S9 chip in aluminium or steel cases.',
    match: ['apple watch'] },
  { name: 'Samsung Galaxy Watch', category: 'wearables', price: 28000, comparePrice: 31000, stock: 22,
    description: 'Smartwatch with sleep tracking, body composition analysis and Wear OS for Samsung Galaxy phones.',
    match: ['galaxy watch'] },
  { name: 'Xiaomi Smart Band 8', category: 'wearables', price: 4500, stock: 60,
    description: 'Slim fitness tracker with AMOLED display, heart-rate and SpO2 monitoring, and 16-day battery.',
    match: ['smart band 8', 'mi band', 'xiaomi smart band'] },
  { name: 'Fitbit Charge 6', category: 'wearables', price: 19500, stock: 28,
    description: 'Fitness and health tracker with built-in GPS, ECG app and Google apps integration.',
    match: ['fitbit'] },
  { name: 'Logitech MX Master 3S Mouse', category: 'computing', price: 11500, stock: 35,
    description: 'Ultra-precise wireless mouse with quiet clicks, MagSpeed scrolling and multi-device pairing.',
    match: ['mx master', 'logitech mx'] },
  { name: 'Logitech MX Keys Wireless Keyboard', category: 'computing', price: 13500, comparePrice: 14800, stock: 20,
    description: 'Advanced wireless illuminated keyboard with smart backlighting and multi-device Easy-Switch.',
    match: ['mx keys', 'logitech keyboard', 'logitech'] },
  { name: 'Anker PowerCore 10000 Power Bank', category: 'mobile-accessories', price: 2800, stock: 80,
    description: 'Ultra-compact 10000mAh portable charger with PowerIQ technology for fast charging on the go.',
    match: ['powercore', 'anker power bank', 'power bank'] },
  { name: 'Anker 735 Charger (GaN, 65W)', category: 'mobile-accessories', price: 5200, stock: 45,
    description: 'Three-port GaN fast charger for laptops, tablets and phones, sized for travel.',
    match: ['anker', 'gan charger', 'charger'] },
  { name: 'Belkin BoostCharge Pro MagSafe Charger', category: 'mobile-accessories', price: 6200, stock: 33,
    description: '2-in-1 MagSafe charging stand and pad with fast wireless charging for iPhone and AirPods.',
    match: ['belkin', 'magsafe'] },
  { name: 'Amazon Echo Dot (5th Gen)', category: 'smart-home', price: 6900, comparePrice: 7500, stock: 50,
    description: 'Compact smart speaker with Alexa for music, smart home control, timers and voice assistance.',
    match: ['echo dot', 'amazon echo'] },
  { name: 'Google Nest Thermostat', category: 'smart-home', price: 14500, stock: 15,
    description: 'Learning smart thermostat that adapts to your schedule and saves energy automatically.',
    match: ['nest thermostat', 'nest learning', 'nest'] },
  { name: 'Philips Hue White and Color Ambiance Bulb', category: 'smart-home', price: 3200, stock: 70,
    description: 'Smart LED bulb with millions of colours, dimming and control from the Hue app or voice.',
    match: ['philips hue', 'hue bulb', 'hue'] },
  { name: 'Nintendo Switch OLED Model', category: 'gaming', price: 42000, stock: 14,
    description: 'Handheld and docked gaming console with a vibrant 7-inch OLED screen and 64GB storage.',
    match: ['switch oled', 'nintendo switch'] },
  { name: 'Sony DualSense Wireless Controller', category: 'gaming', price: 7800, stock: 38,
    description: 'PS5 controller with haptic feedback, adaptive triggers and a built-in microphone.',
    match: ['dualsense', 'playstation 5 controller', 'ps5 controller'] },
  { name: 'Razer DeathAdder V3 Gaming Mouse', category: 'gaming', price: 6800, stock: 42,
    description: 'Ergonomic wired esports mouse with a 30K DPI optical sensor and ultra-light 59g body.',
    match: ['deathadder', 'razer'] },
  { name: 'DJI Mini 3 Drone', category: 'cameras-drones', price: 58000, stock: 10,
    description: 'Lightweight foldable drone with 4K HDR video, 38 minutes flight time and obstacle-free travel.',
    match: ['dji mini', 'mini 3', 'dji'] },
  { name: 'GoPro HERO12 Black', category: 'cameras-drones', price: 45000, comparePrice: 48000, stock: 16,
    description: 'Waterproof action camera with 5.3K video, HyperSmooth stabilisation and a rugged design.',
    match: ['hero12', 'gopro'] },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Commons file pages whose title contains one of the model's match words. */
async function findPhotos(product: RealProduct): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: product.name,
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
    if (product.match.some((m) => title.includes(m))) urls.push(info.thumburl ?? info.url);
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
  const orderItems = await prisma.orderItem.count();
  if (orderItems > 0) {
    throw new Error(`${orderItems} order item(s) reference products; nothing was changed`);
  }

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));
  for (const p of CATALOG) {
    if (!categoryId.has(p.category)) throw new Error(`Unknown category "${p.category}" for ${p.name}`);
  }

  const removed = await prisma.product.deleteMany();
  console.log(`Removed ${removed.count} old products (cart/wishlist rows cascaded)`);

  const created: { id: string; slug: string; product: RealProduct }[] = [];
  for (const p of CATALOG) {
    const slug = slugify(p.name);
    const row = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        description: p.description,
        price: new Prisma.Decimal(p.price.toFixed(2)),
        comparePrice: p.comparePrice ? new Prisma.Decimal(p.comparePrice.toFixed(2)) : null,
        stock: p.stock,
        imageUrl: '',
        isActive: true,
        categoryId: categoryId.get(p.category)!,
      },
    });
    created.push({ id: row.id, slug, product: p });
  }
  console.log(`Created ${created.length} products`);

  let withPhotos = 0;
  let imageCount = 0;
  const missing: string[] = [];

  for (const { id, slug, product } of created) {
    try {
      const sources = await findPhotos(product);
      if (sources.length === 0) {
        missing.push(product.name);
        continue;
      }
      const uploaded: { url: string; publicId: string }[] = [];
      for (const src of sources) {
        uploaded.push(await uploadRemote(src, `gadgetlax/products/${slug}`));
        await sleep(300);
      }
      await prisma.$transaction([
        prisma.productImage.createMany({
          data: uploaded.map((img, position) => ({
            productId: id,
            url: img.url,
            publicId: img.publicId,
            position,
          })),
        }),
        prisma.product.update({ where: { id }, data: { imageUrl: uploaded[0].url } }),
      ]);
      withPhotos++;
      imageCount += uploaded.length;
      console.log(`✔ ${product.name}: ${uploaded.length} photo(s)`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : JSON.stringify(err);
      missing.push(`${product.name} (${reason})`);
      await sleep(3000);
    }
    await sleep(300);
  }

  console.log(`\nDone: ${created.length} products, ${withPhotos} with photos, ${imageCount} photos uploaded.`);
  if (missing.length) {
    console.log('No photo found for:');
    for (const m of missing) console.log(`  - ${m}`);
  }
}

main()
  .catch((e) => {
    console.error('Catalog load failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
