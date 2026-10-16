/**
 * Gadget-store seed script.
 *
 * Wipes ALL existing data (orders, cart items, products, categories, users)
 * and reseeds a fresh gadget catalog: 1 admin + 5 customers, 7 gadget
 * categories, exactly 100 gadget products.
 *
 * Wipe + recreate is naturally idempotent: every run ends with the same data.
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { assertLocalDatabase } from './local-only.js';

try {
  process.loadEnvFile();
} catch {
  // rely on the environment
}
assertLocalDatabase('seed');

const prisma = new PrismaClient();
/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random generator (mulberry32, fixed seed).     */
/* No Math.random() anywhere, so every run produces identical data.    */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261015);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const toDecimal = (n: number) => new Prisma.Decimal(n.toFixed(2));

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */
const ADMIN = {
  email: 'admin@example.com',
  password: 'Admin@123',
  name: 'Store Admin',
  role: 'ADMIN' as const,
};

const CUSTOMERS = [
  { email: 'aarav.sharma@example.com', name: 'Aarav Sharma' },
  { email: 'priya.patel@example.com', name: 'Priya Patel' },
  { email: 'rohan.gupta@example.com', name: 'Rohan Gupta' },
  { email: 'ananya.singh@example.com', name: 'Ananya Singh' },
  { email: 'vikram.mehta@example.com', name: 'Vikram Mehta' },
];
const CUSTOMER_PASSWORD = 'Customer@123';

/* ------------------------------------------------------------------ */
/* Gadget categories (7)                                               */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  {
    slug: 'audio',
    name: 'Audio',
    description: 'Earbuds, headphones, speakers and studio audio gear.',
  },
  {
    slug: 'wearables',
    name: 'Wearables',
    description: 'Smartwatches, fitness trackers and smart rings.',
  },
  {
    slug: 'smart-home',
    name: 'Smart Home',
    description: 'Smart hubs, lighting, security and home automation.',
  },
  {
    slug: 'mobile-accessories',
    name: 'Mobile Accessories',
    description: 'Power banks, chargers, cables, cases and phone gear.',
  },
  {
    slug: 'computing',
    name: 'Computing',
    description: 'Keyboards, mice, docks, webcams and desk setup essentials.',
  },
  {
    slug: 'cameras-drones',
    name: 'Cameras & Drones',
    description: 'Action cameras, camera drones, gimbals and lenses.',
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    description: 'Controllers, gaming headsets, VR and streaming gear.',
  },
];

/* ------------------------------------------------------------------ */
/* Products — exactly 100 across the 7 categories.                     */
/* Each entry: [name, price]. Descriptions are built deterministically. */
/* ------------------------------------------------------------------ */
type ProductDef = { name: string; price: number };

const PRODUCT_DEFS: Record<string, ProductDef[]> = {
  audio: [
    { name: 'NovaBuds Pro Wireless Earbuds', price: 79.99 },
    { name: 'BoomBox Mini Bluetooth Speaker', price: 49.99 },
    { name: 'StudioMax Over-Ear Headphones', price: 149.99 },
    { name: 'AeroPods Lite True Wireless', price: 39.99 },
    { name: 'ThunderBass Party Speaker', price: 129.99 },
    { name: 'ClearCall USB Headset', price: 59.99 },
    { name: 'SoundBar Slim 2.1', price: 119.99 },
    { name: 'RetroTurn Vinyl Bluetooth Speaker', price: 89.99 },
    { name: 'BassPod Neckband Earphones', price: 29.99 },
    { name: 'HiFi DAC Portable Amplifier', price: 99.99 },
    { name: 'SleepBuds Noise Masking Earbuds', price: 69.99 },
    { name: 'Karaoke Mic Pro Wireless', price: 54.99 },
    { name: 'SoundCube Smart Speaker', price: 79.99 },
    { name: 'StudioMic USB Condenser', price: 109.99 },
    { name: 'AirDrum Wireless Headphones', price: 44.99 },
  ],
  wearables: [
    { name: 'AeroWatch GT Smartwatch', price: 199.99 },
    { name: 'PulseBand 6 Fitness Tracker', price: 59.99 },
    { name: 'OrbitWatch Kids GPS', price: 89.99 },
    { name: 'HaloRing Smart Ring', price: 149.99 },
    { name: 'TitanWatch Ultra Rugged', price: 349.99 },
    { name: 'FitClip Activity Tracker', price: 34.99 },
    { name: 'AeroWatch SE Sport', price: 129.99 },
    { name: 'SleepSense Tracker Band', price: 79.99 },
    { name: 'PulseWatch ECG Monitor', price: 249.99 },
    { name: 'TagMate Bluetooth Tracker', price: 24.99 },
    { name: 'LumaBand LED Fitness', price: 44.99 },
    { name: 'AeroWatch Classic Leather', price: 179.99 },
    { name: 'StridePod Running Sensor', price: 69.99 },
    { name: 'VitalPatch Health Monitor', price: 119.99 },
  ],
  'smart-home': [
    { name: 'EchoNest Smart Hub', price: 99.99 },
    { name: 'LumaBulb RGB Smart Bulbs 4-Pack', price: 39.99 },
    { name: 'SecureCam 360 Indoor', price: 69.99 },
    { name: 'ThermoSmart WiFi Thermostat', price: 129.99 },
    { name: 'DoorBell Pro Video', price: 149.99 },
    { name: 'PlugMini Smart Plugs 4-Pack', price: 29.99 },
    { name: 'RoboVac S9 LiDAR', price: 299.99 },
    { name: 'AirPure HEPA Purifier', price: 159.99 },
    { name: 'LumaStrip LED 5m', price: 24.99 },
    { name: 'LockPro Fingerprint Deadbolt', price: 189.99 },
    { name: 'SenseHub Motion Sensors 3-Pack', price: 49.99 },
    { name: 'CurtainBot Auto Opener', price: 79.99 },
    { name: 'GardenSense Soil Monitor', price: 34.99 },
    { name: 'ChimeBox Smart Doorbell', price: 59.99 },
  ],
  'mobile-accessories': [
    { name: 'VoltCore 20000mAh Power Bank', price: 39.99 },
    { name: 'MagCharge 15W Wireless Pad', price: 29.99 },
    { name: 'TurboCable 100W USB-C 2m', price: 14.99 },
    { name: 'GripCase Armor Pro', price: 24.99 },
    { name: 'LensKit Pro Mobile', price: 49.99 },
    { name: 'StandFold Aluminum Dock', price: 19.99 },
    { name: 'VoltCore Slim 10000mAh', price: 27.99 },
    { name: 'CarMount MagSafe Pro', price: 34.99 },
    { name: 'TurboBrick 65W GaN Charger', price: 44.99 },
    { name: 'CableKit Braided 3-Pack', price: 18.99 },
    { name: 'SelfieStick Pro Tripod', price: 32.99 },
    { name: 'MagWallet Leather Card', price: 29.99 },
    { name: 'ScreenGuard Ceramic 2-Pack', price: 12.99 },
    { name: 'VoltCore 30000mAh PD', price: 54.99 },
    { name: 'BudCase Wireless Earbud Case', price: 16.99 },
    { name: 'RingLight Mini Vlog', price: 22.99 },
  ],
  computing: [
    { name: 'KeyForge Mech Keyboard', price: 119.99 },
    { name: 'SwiftMouse Pro Wireless', price: 69.99 },
    { name: 'UltraDock 11-in-1 USB-C', price: 149.99 },
    { name: 'PixelPad Drawing Tablet', price: 199.99 },
    { name: 'VoltHub 7-Port USB Hub', price: 39.99 },
    { name: 'CoolPad Laptop Stand', price: 34.99 },
    { name: 'StreamCam 4K Webcam', price: 129.99 },
    { name: 'KeyForge Mini 65 Percent', price: 89.99 },
    { name: 'ErgoTrack Trackball', price: 79.99 },
    { name: 'SSDVault 1TB Portable', price: 109.99 },
    { name: 'MonitorBar Screen Light', price: 49.99 },
    { name: 'DeskMat XXL RGB', price: 29.99 },
    { name: 'CableDock Organizer Kit', price: 21.99 },
    { name: 'PowerStrip Smart 6-Outlet', price: 44.99 },
  ],
  'cameras-drones': [
    { name: 'SkyHawk 4K Drone', price: 299.99 },
    { name: 'ActionCam X5 Waterproof', price: 199.99 },
    { name: 'SkyHawk Mini SE', price: 149.99 },
    { name: 'GimbalPro 3-Axis', price: 129.99 },
    { name: 'LensPro Wide Angle', price: 89.99 },
    { name: 'SkyHawk FPV Racer', price: 399.99 },
    { name: 'TripodMax Carbon 2m', price: 119.99 },
    { name: 'ActionCam Float Grip', price: 24.99 },
    { name: 'DroneBag Hard Case', price: 59.99 },
    { name: 'SkyHawk Battery Plus', price: 69.99 },
    { name: 'CamLight LED Panel', price: 74.99 },
    { name: 'LensPro Macro Kit', price: 54.99 },
    { name: 'SkyHawk Prop Guard Set', price: 19.99 },
  ],
  gaming: [
    { name: 'StrikePad Pro Controller', price: 69.99 },
    { name: 'VoltHeadset 7.1 Gaming', price: 99.99 },
    { name: 'ArcadeStick Retro Pro', price: 129.99 },
    { name: 'StrikePad Elite Wireless', price: 149.99 },
    { name: 'GameDock Switch Station', price: 59.99 },
    { name: 'VoltChair RGB Gaming', price: 249.99 },
    { name: 'KeyForge Game Keypad', price: 79.99 },
    { name: 'StreamDeck Mini 6-Key', price: 89.99 },
    { name: 'VRSense Headset', price: 349.99 },
    { name: 'StrikeMouse 26K DPI', price: 59.99 },
    { name: 'GameStream Capture 4K', price: 139.99 },
    { name: 'VoltPad Cooling Stand', price: 39.99 },
    { name: 'ArcadeMini Handheld', price: 119.99 },
    { name: 'ChatMix Gaming Mixer', price: 109.99 },
  ],
};

const DESC_TEMPLATES: Record<string, [string, string]> = {
  audio: [
    'The {name} delivers rich, detailed sound for music, calls and gaming.',
    'Premium drivers, long battery life and a comfortable all-day fit.',
  ],
  wearables: [
    'The {name} keeps your health and notifications on your wrist.',
    'Accurate sensors, bright display and multi-day battery life.',
  ],
  'smart-home': [
    'The {name} makes your home smarter, safer and more convenient.',
    'Easy app setup with voice-assistant support out of the box.',
  ],
  'mobile-accessories': [
    'The {name} is an everyday essential for your phone.',
    'Durable build and fast performance you can rely on daily.',
  ],
  computing: [
    'The {name} upgrades your desk setup for work and play.',
    'Precision engineering with plug-and-play connectivity.',
  ],
  'cameras-drones': [
    'The {name} captures stunning footage from ground or sky.',
    'Stabilized 4K video, smart flight modes and pro-grade optics.',
  ],
  gaming: [
    'The {name} gives you the competitive edge in every match.',
    'Low latency, pro-grade precision and tournament-ready build.',
  ],
};

function buildDescription(categorySlug: string, productName: string): string {
  const [t1, t2] = DESC_TEMPLATES[categorySlug];
  return `${t1.replace('{name}', productName)} ${t2}`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  /* ------------------------- Wipe old data ------------------------- */
  // FK-safe order: children before parents.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log('Wiped: order items, orders, cart items, products, categories, users');

  /* ------------------------------ Users ----------------------------- */
  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await prisma.user.create({
    data: {
      email: ADMIN.email,
      passwordHash: adminHash,
      name: ADMIN.name,
      role: ADMIN.role,
    },
  });

  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);
  for (const c of CUSTOMERS) {
    await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: customerHash,
        name: c.name,
        role: 'CUSTOMER',
      },
    });
  }

  /* ---------------------------- Categories ---------------------------- */
  const categoryIdBySlug: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const record = await prisma.category.create({
      data: { slug: cat.slug, name: cat.name, description: cat.description },
    });
    categoryIdBySlug[record.slug] = record.id;
  }

  /* ----------------------------- Products ----------------------------- */
  const totalDefs = Object.values(PRODUCT_DEFS).reduce((n, arr) => n + arr.length, 0);
  if (totalDefs !== 100) {
    throw new Error(`Product definitions must total exactly 100, found ${totalDefs}`);
  }

  let productCount = 0;
  let discountedCount = 0;
  let outOfStockCount = 0;
  let inactiveCount = 0;
  const perCategory: Record<string, number> = {};

  for (const cat of CATEGORIES) {
    const defs = PRODUCT_DEFS[cat.slug];
    perCategory[cat.slug] = defs.length;
    for (const def of defs) {
      const slug = `${cat.slug}-${slugify(def.name)}`;
      const price = def.price;

      // ~25% get a comparePrice 10–40% higher than price.
      let comparePrice: Prisma.Decimal | null = null;
      if (rand() < 0.25) {
        comparePrice = toDecimal(price * (1.1 + rand() * 0.3));
        discountedCount++;
      }

      // ~8% are exactly out of stock, rest 1–200.
      const stockRoll = rand();
      const stock = stockRoll < 0.08 ? 0 : 1 + Math.floor(rand() * 200);
      if (stock === 0) outOfStockCount++;

      // ~95% active.
      const isActive = rand() < 0.95;
      if (!isActive) inactiveCount++;

      await prisma.product.create({
        data: {
          slug,
          name: def.name,
          description: buildDescription(cat.slug, def.name),
          price: toDecimal(price),
          comparePrice,
          stock,
          // Images are attached afterwards by prisma/import-product-images.ts (Cloudinary)
          imageUrl: '',
          isActive,
          categoryId: categoryIdBySlug[cat.slug],
        },
      });
      productCount++;
    }
  }

  /* ------------------------------ Summary ------------------------------ */
  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const dbProductCount = await prisma.product.count();
  const dbOrderCount = await prisma.order.count();

  console.log('Seed complete:');
  console.log(`  users: ${userCount} (1 admin + 5 customers)`);
  console.log(`  categories: ${categoryCount}`);
  console.log(`  per category: ${JSON.stringify(perCategory)}`);
  console.log(
    `  products: ${dbProductCount} (created this run: ${productCount}, discounted: ${discountedCount}, out-of-stock: ${outOfStockCount}, inactive: ${inactiveCount})`,
  );
  console.log(`  orders: ${dbOrderCount} (not seeded)`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
