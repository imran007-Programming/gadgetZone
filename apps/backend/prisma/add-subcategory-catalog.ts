/**
 * Dev-only: gives every top-level category 3–4 subcategories and fills each
 * subcategory with real products (existing products are moved into the
 * matching subcategory). Safe to re-run: brands, categories and products are
 * matched by slug, and existing products keep their price, stock and images.
 *
 * Photos are attached afterwards from product-images/<slug>/ with
 * npm run images:import (it only fills products that have no images yet).
 *
 * Run with: npm run catalog:subcategories
 */
import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile();
} catch {
  // rely on the environment
}

const prisma = new PrismaClient();

/** parent slug → subcategories in display order */
const SUBCATEGORIES: Record<string, [name: string, slug: string][]> = {
  audio: [
    ['Headphones', 'headphones'],
    ['Earbuds', 'earbuds'],
    ['Speakers', 'speakers'],
  ],
  'cameras-drones': [
    ['Action Cameras', 'action-cameras'],
    ['Drones', 'drones'],
    ['Gimbals', 'gimbals'],
  ],
  computing: [
    ['Keyboards', 'keyboards'],
    ['Mice', 'mice'],
    ['Webcams', 'webcams'],
    ['USB Hubs & Docks', 'usb-hubs'],
  ],
  gaming: [
    ['Consoles', 'consoles'],
    ['Controllers', 'controllers'],
    ['Gaming Mice', 'gaming-mice'],
    ['Gaming Headsets', 'gaming-headsets'],
  ],
  'mobile-accessories': [
    ['Chargers', 'chargers'],
    ['Power Banks', 'power-banks'],
    ['Cables', 'cables'],
  ],
  'smart-home': [
    ['Smart Speakers', 'smart-speakers'],
    ['Smart Lighting', 'smart-lighting'],
    ['Security Cameras', 'security-cameras'],
    ['Climate Control', 'climate-control'],
  ],
  wearables: [
    ['Smartwatches', 'smartwatches'],
    ['Fitness Trackers', 'fitness-trackers'],
    ['Smart Rings', 'smart-rings'],
  ],
};

/** Brands the new products need (logos can be added later in Admin → Brands). */
const NEW_BRANDS: [name: string, slug: string][] = [
  ['Insta360', 'insta360'],
  ['Zhiyun', 'zhiyun'],
  ['UGREEN', 'ugreen'],
  ['HyperX', 'hyperx'],
  ['TP-Link', 'tp-link'],
  ['Microsoft', 'microsoft'],
  ['Oura', 'oura'],
];

/** Existing products → their subcategory. */
const MOVES: Record<string, string> = {
  'sony-wh-1000xm5-wireless-headphones': 'headphones',
  'apple-airpods-pro-2nd-generation': 'earbuds',
  'jbl-flip-6-portable-bluetooth-speaker': 'speakers',
  'gopro-hero12-black': 'action-cameras',
  'dji-mini-3-drone': 'drones',
  'logitech-mx-keys-wireless-keyboard': 'keyboards',
  'logitech-mx-master-3s-mouse': 'mice',
  'nintendo-switch-oled-model': 'consoles',
  'sony-dualsense-wireless-controller': 'controllers',
  'razer-deathadder-v3-gaming-mouse': 'gaming-mice',
  'anker-735-charger-gan-65w': 'chargers',
  'belkin-boostcharge-pro-magsafe-charger': 'chargers',
  'anker-powercore-10000-power-bank': 'power-banks',
  'amazon-echo-dot-5th-gen': 'smart-speakers',
  'philips-hue-white-and-color-ambiance-bulb': 'smart-lighting',
  'google-nest-thermostat': 'climate-control',
  'apple-watch-series-9': 'smartwatches',
  'samsung-galaxy-watch': 'smartwatches',
  'fitbit-charge-6': 'fitness-trackers',
  'xiaomi-smart-band-8': 'fitness-trackers',
};

interface NewProduct {
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  comparePrice?: number;
  stock: number;
  description: string;
}

const PRODUCTS: NewProduct[] = [
  // Audio
  { name: 'Soundcore Space One Noise Cancelling Headphones', slug: 'soundcore-space-one-headphones', brand: 'anker', category: 'headphones', price: 11500, comparePrice: 13000, stock: 30,
    description: 'Over-ear headphones with adaptive active noise cancelling, LDAC hi-res wireless audio and up to 40 hours of playtime with ANC on.' },
  { name: 'JBL Tune 770NC Wireless Headphones', slug: 'jbl-tune-770nc-headphones', brand: 'jbl', category: 'headphones', price: 12500, comparePrice: 14000, stock: 25,
    description: 'Lightweight foldable headphones with adaptive noise cancelling, JBL Pure Bass sound and up to 70 hours of battery life.' },
  { name: 'Samsung Galaxy Buds2 Pro', slug: 'samsung-galaxy-buds2-pro', brand: 'samsung', category: 'earbuds', price: 18500, comparePrice: 21000, stock: 28,
    description: 'Compact true wireless earbuds with intelligent ANC, 24-bit Hi-Fi audio and 360 Audio for an immersive sound stage.' },
  { name: 'Soundcore Liberty 4 NC Earbuds', slug: 'soundcore-liberty-4-nc-earbuds', brand: 'anker', category: 'earbuds', price: 9500, comparePrice: 11000, stock: 40,
    description: 'True wireless earbuds with adaptive noise cancelling that reduces up to 98.5% of noise, LDAC support and 50 hours with the case.' },
  { name: 'Soundcore Motion 300 Bluetooth Speaker', slug: 'soundcore-motion-300-speaker', brand: 'anker', category: 'speakers', price: 9900, stock: 35,
    description: 'Portable 30W stereo speaker with hi-res wireless audio, a customizable EQ and an IPX7 waterproof build.' },
  { name: 'Sony SRS-XB100 Portable Speaker', slug: 'sony-srs-xb100-speaker', brand: 'sony', category: 'speakers', price: 6500, comparePrice: 7200, stock: 45,
    description: 'Pocket-size Bluetooth speaker with EXTRA BASS sound, an IP67 dust and water resistant body, a strap and 16 hours of battery.' },

  // Cameras & Drones
  { name: 'DJI Osmo Action 4 Action Camera', slug: 'dji-osmo-action-4', brand: 'dji', category: 'action-cameras', price: 42000, comparePrice: 46000, stock: 15,
    description: '1/1.3-inch sensor action camera shooting 4K/120fps, with 10-bit D-Log M colour, front and rear touchscreens and 18 m waterproofing.' },
  { name: 'Insta360 X3 360° Action Camera', slug: 'insta360-x3', brand: 'insta360', category: 'action-cameras', price: 48000, stock: 12,
    description: '360° camera with 5.7K video, a 2.29-inch touchscreen, invisible selfie stick effect and FlowState stabilization.' },
  { name: 'DJI Mini 4 Pro Drone', slug: 'dji-mini-4-pro-drone', brand: 'dji', category: 'drones', price: 115000, comparePrice: 125000, stock: 8,
    description: 'Under-249 g folding drone with a 4K/60fps HDR camera, omnidirectional obstacle sensing and up to 20 km video transmission.' },
  { name: 'DJI Osmo Mobile 6 Smartphone Gimbal', slug: 'dji-osmo-mobile-6', brand: 'dji', category: 'gimbals', price: 16500, comparePrice: 18000, stock: 20,
    description: 'Foldable 3-axis phone gimbal with ActiveTrack 6.0, a built-in extension rod and quick launch for smooth handheld video.' },
  { name: 'Zhiyun Smooth 5S Smartphone Gimbal', slug: 'zhiyun-smooth-5s', brand: 'zhiyun', category: 'gimbals', price: 17500, stock: 14,
    description: '3-axis smartphone stabilizer with powerful motors, a built-in fill light and a full control panel for creators.' },

  // Computing
  { name: 'Logitech K380 Multi-Device Bluetooth Keyboard', slug: 'logitech-k380-keyboard', brand: 'logitech', category: 'keyboards', price: 4200, comparePrice: 4800, stock: 50,
    description: 'Compact, quiet Bluetooth keyboard that pairs with up to three devices and switches between them at the press of a key.' },
  { name: 'Logitech Pebble M350 Wireless Mouse', slug: 'logitech-pebble-m350-mouse', brand: 'logitech', category: 'mice', price: 2200, comparePrice: 2600, stock: 60,
    description: 'Slim, silent wireless mouse with Bluetooth and USB receiver connectivity and up to 18 months of battery life.' },
  { name: 'Logitech C920 HD Pro Webcam', slug: 'logitech-c920-webcam', brand: 'logitech', category: 'webcams', price: 8500, comparePrice: 9500, stock: 30,
    description: 'Full HD 1080p webcam with dual stereo microphones, automatic light correction and a universal monitor clip.' },
  { name: 'Logitech Brio 4K Webcam', slug: 'logitech-brio-4k-webcam', brand: 'logitech', category: 'webcams', price: 21000, stock: 12,
    description: 'Ultra HD 4K webcam with HDR, adjustable field of view and Windows Hello face recognition support.' },
  { name: 'Anker 341 USB-C Hub (7-in-1)', slug: 'anker-341-usb-c-hub', brand: 'anker', category: 'usb-hubs', price: 4500, comparePrice: 5200, stock: 40,
    description: 'USB-C hub with 4K HDMI, 100W power delivery pass-through, two USB-A ports, a USB-C data port and SD/microSD card readers.' },
  { name: 'UGREEN 5-in-1 USB-C Hub', slug: 'ugreen-5-in-1-usb-c-hub', brand: 'ugreen', category: 'usb-hubs', price: 3200, stock: 45,
    description: 'Slim aluminium USB-C hub with 4K HDMI, one 5Gbps USB-A port, two USB-A 2.0 ports and 100W PD pass-through charging.' },

  // Gaming
  { name: 'PlayStation 5 Slim Console', slug: 'playstation-5-slim', brand: 'sony', category: 'consoles', price: 72000, comparePrice: 78000, stock: 10,
    description: 'Slimmer PS5 with a 1TB SSD, ultra-fast loading, ray tracing, 4K gaming and the DualSense wireless controller in the box.' },
  { name: 'Xbox Wireless Controller', slug: 'xbox-wireless-controller', brand: 'microsoft', category: 'controllers', price: 7500, stock: 30,
    description: 'Xbox controller with textured grips, a hybrid D-pad and a share button; works with Xbox, Windows PCs and phones.' },
  { name: 'Logitech G502 HERO Gaming Mouse', slug: 'logitech-g502-hero', brand: 'logitech', category: 'gaming-mice', price: 5500, comparePrice: 6500, stock: 35,
    description: 'Wired gaming mouse with the HERO 25K sensor, 11 programmable buttons, adjustable weights and LIGHTSYNC RGB.' },
  { name: 'HyperX Cloud II Gaming Headset', slug: 'hyperx-cloud-ii-headset', brand: 'hyperx', category: 'gaming-headsets', price: 9500, comparePrice: 11000, stock: 25,
    description: 'Comfortable memory-foam gaming headset with virtual 7.1 surround sound, a detachable noise-cancelling mic and 53mm drivers.' },
  { name: 'Razer BlackShark V2 X Gaming Headset', slug: 'razer-blackshark-v2-x', brand: 'razer', category: 'gaming-headsets', price: 6200, stock: 30,
    description: 'Lightweight esports headset with 50mm TriForce drivers, passive noise cancellation and a cardioid microphone.' },

  // Mobile Accessories
  { name: 'Samsung 25W Super Fast Charger', slug: 'samsung-25w-super-fast-charger', brand: 'samsung', category: 'chargers', price: 1800, comparePrice: 2200, stock: 80,
    description: 'Official Samsung USB-C wall charger with 25W Super Fast Charging for Galaxy phones and other USB PD devices.' },
  { name: 'Anker 737 Power Bank (PowerCore 24K)', slug: 'anker-737-power-bank', brand: 'anker', category: 'power-banks', price: 15500, comparePrice: 17500, stock: 20,
    description: '24,000mAh power bank with 140W two-way fast charging and a smart digital display that shows output and remaining charge.' },
  { name: 'Anker PowerLine III USB-C Cable', slug: 'anker-powerline-iii-usb-c-cable', brand: 'anker', category: 'cables', price: 1500, stock: 100,
    description: 'Durable USB-C to USB-C cable rated for 25,000+ bends, supporting up to 100W charging for phones, tablets and laptops.' },
  { name: 'UGREEN USB-C to Lightning Cable', slug: 'ugreen-usb-c-to-lightning-cable', brand: 'ugreen', category: 'cables', price: 1400, comparePrice: 1700, stock: 90,
    description: 'MFi-certified braided USB-C to Lightning cable for 20W fast charging of iPhone and AirPods.' },

  // Smart Home
  { name: 'Google Nest Mini (2nd Gen)', slug: 'google-nest-mini-2nd-gen', brand: 'google', category: 'smart-speakers', price: 5500, stock: 35,
    description: 'Compact smart speaker with Google Assistant, richer bass than the original and a wall-mountable design.' },
  { name: 'TP-Link Tapo L530E Smart Wi-Fi Bulb', slug: 'tp-link-tapo-l530e-bulb', brand: 'tp-link', category: 'smart-lighting', price: 1900, comparePrice: 2300, stock: 70,
    description: 'Multicolour dimmable Wi-Fi LED bulb with 16 million colours, schedules and voice control through Alexa or Google Assistant.' },
  { name: 'TP-Link Tapo C200 Security Camera', slug: 'tp-link-tapo-c200-camera', brand: 'tp-link', category: 'security-cameras', price: 3500, comparePrice: 4200, stock: 40,
    description: 'Pan/tilt home Wi-Fi camera with 1080p video, night vision, motion detection and two-way audio.' },
  { name: 'Xiaomi Smart Camera C300', slug: 'xiaomi-smart-camera-c300', brand: 'xiaomi', category: 'security-cameras', price: 4800, stock: 30,
    description: '2K 360° indoor security camera with AI human detection, infrared night vision and microSD or cloud storage.' },
  { name: 'Xiaomi Smart Air Purifier 4 Compact', slug: 'xiaomi-smart-air-purifier-4-compact', brand: 'xiaomi', category: 'climate-control', price: 14500, comparePrice: 16500, stock: 15,
    description: 'Compact HEPA air purifier for rooms up to 27 m², with app control, a real-time air quality display and quiet sleep mode.' },

  // Wearables
  { name: 'Samsung Galaxy Ring', slug: 'samsung-galaxy-ring', brand: 'samsung', category: 'smart-rings', price: 45000, stock: 10,
    description: 'Titanium smart ring that tracks sleep, heart rate and activity, with up to 7 days of battery and no subscription.' },
  { name: 'Oura Ring 4', slug: 'oura-ring-4', brand: 'oura', category: 'smart-rings', price: 52000, stock: 8,
    description: 'Lightweight titanium smart ring with advanced sleep, readiness and heart-rate tracking and up to 8 days of battery.' },
];

async function main() {
  // Subcategories
  for (const [parentSlug, subs] of Object.entries(SUBCATEGORIES)) {
    const parent = await prisma.category.findUnique({ where: { slug: parentSlug } });
    if (!parent) {
      console.log(`! parent category "${parentSlug}" not found, skipped`);
      continue;
    }
    for (const [i, [name, slug]] of subs.entries()) {
      await prisma.category.upsert({
        where: { slug },
        create: { name, slug, parentId: parent.id, position: i + 1 },
        update: { name, parentId: parent.id, position: i + 1 },
      });
    }
    console.log(`✔ ${parentSlug}: ${subs.map(([n]) => n).join(', ')}`);
  }

  for (const [name, slug] of NEW_BRANDS) {
    await prisma.brand.upsert({ where: { slug }, create: { name, slug }, update: {} });
  }

  const categoryId = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  const brandId = new Map((await prisma.brand.findMany()).map((b) => [b.slug, b.id]));
  const need = (map: Map<string, string>, slug: string, what: string) => {
    const id = map.get(slug);
    if (!id) throw new Error(`${what} "${slug}" not found`);
    return id;
  };

  let moved = 0;
  for (const [slug, category] of Object.entries(MOVES)) {
    const res = await prisma.product.updateMany({
      where: { slug },
      data: { categoryId: need(categoryId, category, 'Category') },
    });
    moved += res.count;
  }

  let created = 0;
  for (const p of PRODUCTS) {
    const exists = await prisma.product.findUnique({ where: { slug: p.slug } });
    const data = {
      name: p.name,
      description: p.description,
      categoryId: need(categoryId, p.category, 'Category'),
      brandId: need(brandId, p.brand, 'Brand'),
    };
    if (exists) {
      await prisma.product.update({ where: { slug: p.slug }, data });
    } else {
      await prisma.product.create({
        data: {
          ...data,
          slug: p.slug,
          price: p.price,
          comparePrice: p.comparePrice ?? null,
          stock: p.stock,
          imageUrl: '',
        },
      });
      created++;
    }
  }

  console.log(`\nMoved ${moved} existing product(s); created ${created} new product(s) (${PRODUCTS.length - created} already existed).`);
}

main()
  .catch((e) => {
    console.error('Catalog update failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
