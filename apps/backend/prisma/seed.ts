/**
 * Database seed script — idempotent: safe to run repeatedly.
 * Uses upsert on unique fields (email / slug) and deletes + recreates
 * the seeded customers' orders, so re-runs produce identical counts.
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

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
const rand = mulberry32(20261014);

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
/* Categories                                                          */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  {
    slug: 'electronics',
    name: 'Electronics',
    description: 'Gadgets, audio, computing and smart home devices.',
  },
  {
    slug: 'fashion',
    name: 'Fashion',
    description: 'Clothing, footwear and accessories for every style.',
  },
  {
    slug: 'home-kitchen',
    name: 'Home & Kitchen',
    description: 'Appliances, cookware and comfort for your home.',
  },
  { slug: 'books', name: 'Books', description: 'Bestsellers, classics and learning for every reader.' },
  {
    slug: 'sports',
    name: 'Sports',
    description: 'Fitness gear, outdoor equipment and training essentials.',
  },
  {
    slug: 'beauty',
    name: 'Beauty',
    description: 'Skincare, haircare and cosmetics from trusted brands.',
  },
];

/* ------------------------------------------------------------------ */
/* Products — exactly 100, distributed 17/17/17/17/16/16.               */
/* Each entry: [name, price]. Descriptions are built deterministically. */
/* ------------------------------------------------------------------ */
type ProductDef = { name: string; price: number };

const PRODUCT_DEFS: Record<string, ProductDef[]> = {
  electronics: [
    { name: 'Wireless Bluetooth Headphones', price: 89.99 },
    { name: 'Smart Watch Series 5', price: 199.99 },
    { name: '4K Action Camera', price: 149.99 },
    { name: 'Portable Power Bank 10000mAh', price: 29.99 },
    { name: 'USB-C Fast Charger 65W', price: 34.99 },
    { name: 'Mechanical Gaming Keyboard', price: 119.99 },
    { name: 'Wireless Ergonomic Mouse', price: 39.99 },
    { name: 'Noise-Cancelling Earbuds', price: 69.99 },
    { name: '27 inch 4K Monitor', price: 329.99 },
    { name: 'Drone with HD Camera', price: 249.99 },
    { name: 'Smart Home Speaker', price: 79.99 },
    { name: 'Robot Vacuum Cleaner', price: 279.99 },
    { name: 'Sonic Electric Toothbrush', price: 49.99 },
    { name: 'Portable Bluetooth Speaker', price: 59.99 },
    { name: 'Laptop Cooling Stand', price: 24.99 },
    { name: 'VR Headset Pro', price: 299.99 },
    { name: 'LED Desk Lamp with Wireless Charger', price: 44.99 },
  ],
  fashion: [
    { name: "Men's Denim Jacket", price: 79.99 },
    { name: "Women's Summer Floral Dress", price: 54.99 },
    { name: 'Unisex Running Sneakers', price: 89.99 },
    { name: 'Leather Biker Jacket', price: 149.99 },
    { name: 'Classic White Cotton T-Shirt', price: 19.99 },
    { name: 'Slim-Fit Chino Pants', price: 44.99 },
    { name: 'Wool Blend Overcoat', price: 189.99 },
    { name: 'Canvas Backpack', price: 39.99 },
    { name: 'Aviator Sunglasses', price: 29.99 },
    { name: 'Stainless Steel Watch', price: 129.99 },
    { name: 'Silk Scarf', price: 34.99 },
    { name: 'Hooded Sweatshirt', price: 49.99 },
    { name: 'High-Waist Jeans', price: 59.99 },
    { name: 'Leather Chelsea Boots', price: 139.99 },
    { name: 'Striped Polo Shirt', price: 34.99 },
    { name: 'Cashmere Sweater', price: 99.99 },
    { name: 'Sport Leggings', price: 39.99 },
  ],
  'home-kitchen': [
    { name: 'Stainless Steel Cookware Set', price: 199.99 },
    { name: 'Air Fryer 5.5L', price: 129.99 },
    { name: 'Memory Foam Mattress Topper', price: 89.99 },
    { name: 'Robot Mop', price: 179.99 },
    { name: 'Ceramic Dinnerware Set 16-Piece', price: 74.99 },
    { name: 'Espresso Machine', price: 249.99 },
    { name: 'Bamboo Cutting Board Set', price: 29.99 },
    { name: 'Aromatherapy Essential Oil Diffuser', price: 34.99 },
    { name: 'Blackout Curtains Pair', price: 49.99 },
    { name: 'Electric Kettle 1.7L', price: 39.99 },
    { name: 'Non-Stick Frying Pan Set', price: 59.99 },
    { name: 'Smart LED Floor Lamp', price: 69.99 },
    { name: 'Vacuum Storage Bags 12-Pack', price: 19.99 },
    { name: 'Cotton Bed Sheet Set', price: 54.99 },
    { name: 'Stand Mixer', price: 199.99 },
    { name: 'Modern Minimalist Wall Clock', price: 24.99 },
    { name: 'Insulated Water Bottle 1L', price: 27.99 },
  ],
  sports: [
    { name: 'Premium Yoga Mat 6mm', price: 34.99 },
    { name: 'Adjustable Dumbbell Set', price: 149.99 },
    { name: 'Resistance Bands Set of 5', price: 24.99 },
    { name: 'Football Size 5', price: 29.99 },
    { name: 'Pro Basketball Indoor Outdoor', price: 39.99 },
    { name: 'Carbon Fiber Tennis Racket', price: 99.99 },
    { name: 'Badminton Racket Pair', price: 44.99 },
    { name: 'Speed Skipping Rope', price: 12.99 },
    { name: 'Camping Tent 4-Person', price: 159.99 },
    { name: 'Hiking Backpack 65L', price: 89.99 },
    { name: 'Insulated Sports Water Bottle', price: 22.99 },
    { name: 'Cycling Helmet', price: 49.99 },
    { name: 'Fitness Tracker Band', price: 59.99 },
    { name: 'Kettlebell 12kg', price: 54.99 },
    { name: 'Pickleball Paddle Set', price: 69.99 },
    { name: 'Foldable Electric Treadmill', price: 449.99 },
    { name: 'Boxing Gloves 14oz', price: 39.99 },
  ],
  books: [
    { name: 'The Alchemist by Paulo Coelho', price: 12.99 },
    { name: 'Atomic Habits by James Clear', price: 16.99 },
    { name: 'Sapiens by Yuval Noah Harari', price: 19.99 },
    { name: 'The Great Gatsby', price: 9.99 },
    { name: '1984 by George Orwell', price: 10.99 },
    { name: 'Dune by Frank Herbert', price: 18.99 },
    { name: 'To Kill a Mockingbird', price: 11.99 },
    { name: 'The Hobbit', price: 14.99 },
    { name: 'Educated by Tara Westover', price: 17.99 },
    { name: 'The Silent Patient', price: 15.99 },
    { name: 'Harry Potter Complete Box Set', price: 89.99 },
    { name: 'The Lean Startup', price: 21.99 },
    { name: 'Pride and Prejudice', price: 8.99 },
    { name: 'The Midnight Library', price: 16.99 },
    { name: 'Clean Code by Robert C. Martin', price: 34.99 },
    { name: 'The Psychology of Money', price: 18.99 },
  ],
  beauty: [
    { name: 'Vitamin C Face Serum', price: 24.99 },
    { name: 'Hydrating Hyaluronic Acid Moisturizer', price: 29.99 },
    { name: 'Matte Lipstick Set of 6', price: 34.99 },
    { name: 'Natural Shea Body Butter', price: 19.99 },
    { name: 'Charcoal Face Mask', price: 16.99 },
    { name: 'Ionic Hair Dryer 2000W', price: 59.99 },
    { name: 'Electric Facial Cleansing Brush', price: 39.99 },
    { name: 'Organic Argan Hair Oil', price: 22.99 },
    { name: 'Waterproof Mascara', price: 14.99 },
    { name: 'Mineral Sunscreen SPF 50', price: 21.99 },
    { name: 'Jade Roller and Gua Sha Set', price: 17.99 },
    { name: 'Makeup Brush Set 12-Piece', price: 29.99 },
    { name: 'Exfoliating Body Scrub', price: 18.99 },
    { name: 'Night Repair Retinol Cream', price: 32.99 },
    { name: 'Eau de Parfum 100ml', price: 74.99 },
    { name: 'Nail Polish Set 12 Colors', price: 26.99 },
  ],
};

const DESC_TEMPLATES: Record<string, [string, string]> = {
  electronics: [
    'A dependable {name} engineered for daily performance.',
    'Crisp build quality, smart features and long battery life in one package.',
  ],
  fashion: [
    'A wardrobe essential: the {name} combines comfort with timeless style.',
    'Crafted from quality fabrics with a modern fit that works every day.',
  ],
  'home-kitchen': [
    'The {name} makes everyday living easier and more comfortable.',
    'Durable materials and thoughtful design built to last for years.',
  ],
  sports: [
    'Train harder with the {name}, built for performance and durability.',
    'Designed for athletes of every level, from beginners to pros.',
  ],
  books: [
    '{name} — a must-read that belongs on every shelf.',
    'A reader favourite with timeless ideas and an engaging read.',
  ],
  beauty: [
    'The {name} brings a little luxury to your daily routine.',
    'Gentle, effective formula made with quality ingredients.',
  ],
};

function buildDescription(categorySlug: string, productName: string): string {
  const [t1, t2] = DESC_TEMPLATES[categorySlug];
  return `${t1.replace('{name}', productName)} ${t2}`;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */
const ADDRESSES = [
  {
    name: 'Aarav Sharma',
    street: 'House 12, Road 5, Dhanmondi',
    city: 'Dhaka',
    postalCode: '1205',
    country: 'Bangladesh',
  },
  {
    name: 'Priya Patel',
    street: 'Flat 7B, Gulshan Avenue',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
  },
  {
    name: 'Rohan Gupta',
    street: '21 Lake Circus, Kalabagan',
    city: 'Dhaka',
    postalCode: '1205',
    country: 'Bangladesh',
  },
];

const ORDER_PLAN: { customerIndex: number; status: 'DELIVERED' | 'PAID' | 'PENDING'; itemCount: number }[] = [
  { customerIndex: 0, status: 'DELIVERED', itemCount: 3 },
  { customerIndex: 0, status: 'PENDING', itemCount: 2 },
  { customerIndex: 1, status: 'PAID', itemCount: 4 },
  { customerIndex: 2, status: 'DELIVERED', itemCount: 2 },
];

async function main() {
  /* ------------------------------ Users ------------------------------ */
  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { passwordHash: adminHash, name: ADMIN.name, role: ADMIN.role },
    create: {
      email: ADMIN.email,
      passwordHash: adminHash,
      name: ADMIN.name,
      role: ADMIN.role,
    },
  });

  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);
  const customers = [];
  for (const c of CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { passwordHash: customerHash, name: c.name, role: 'CUSTOMER' },
      create: { email: c.email, passwordHash: customerHash, name: c.name, role: 'CUSTOMER' },
    });
    customers.push(user);
  }

  /* ---------------------------- Categories ---------------------------- */
  const categoryIdBySlug: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: { slug: cat.slug, name: cat.name, description: cat.description },
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

  for (const cat of CATEGORIES) {
    const defs = PRODUCT_DEFS[cat.slug];
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

      // ~90% active.
      const isActive = rand() < 0.9;
      if (!isActive) inactiveCount++;

      await prisma.product.upsert({
        where: { slug },
        update: {
          name: def.name,
          description: buildDescription(cat.slug, def.name),
          price: toDecimal(price),
          comparePrice,
          stock,
          imageUrl: `https://picsum.photos/seed/${slug}/600/600`,
          isActive,
          categoryId: categoryIdBySlug[cat.slug],
        },
        create: {
          slug,
          name: def.name,
          description: buildDescription(cat.slug, def.name),
          price: toDecimal(price),
          comparePrice,
          stock,
          imageUrl: `https://picsum.photos/seed/${slug}/600/600`,
          isActive,
          categoryId: categoryIdBySlug[cat.slug],
        },
      });
      productCount++;
    }
  }

  /* ------------------------------ Orders ------------------------------ */
  // Idempotency: wipe orders of the seeded customers (OrderItems cascade),
  // then recreate deterministically.
  const customerIds = customers.map((c) => c.id);
  await prisma.order.deleteMany({ where: { userId: { in: customerIds } } });

  // Pick from active, in-stock products ordered by slug for determinism.
  const orderable = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    orderBy: { slug: 'asc' },
    select: { id: true, price: true },
  });
  if (orderable.length === 0) throw new Error('No orderable products available for seeding orders');

  let orderCount = 0;
  let orderItemCount = 0;
  for (const plan of ORDER_PLAN) {
    const customer = customers[plan.customerIndex];
    const used = new Set<number>();
    const items: { productId: string; quantity: number; unitPrice: Prisma.Decimal }[] = [];
    while (items.length < plan.itemCount) {
      const idx = Math.floor(rand() * orderable.length);
      if (used.has(idx)) continue;
      used.add(idx);
      const product = orderable[idx];
      const quantity = 1 + Math.floor(rand() * 3); // 1–3
      items.push({ productId: product.id, quantity, unitPrice: product.price });
    }
    const totalAmount = items.reduce(
      (sum, it) => sum.add(it.unitPrice.mul(it.quantity)),
      new Prisma.Decimal(0),
    );

    await prisma.order.create({
      data: {
        userId: customer.id,
        status: plan.status,
        totalAmount,
        shippingAddress: ADDRESSES[plan.customerIndex],
        items: { create: items },
      },
    });
    orderCount++;
    orderItemCount += items.length;
  }

  /* ------------------------------ Summary ------------------------------ */
  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const dbProductCount = await prisma.product.count();
  const dbOrderCount = await prisma.order.count();

  console.log('Seed complete:');
  console.log(`  users: ${userCount} (1 admin + 5 customers)`);
  console.log(`  categories: ${categoryCount}`);
  console.log(
    `  products: ${dbProductCount} (upserted this run: ${productCount}, discounted: ${discountedCount}, out-of-stock: ${outOfStockCount}, inactive: ${inactiveCount})`,
  );
  console.log(`  orders: ${dbOrderCount} (created this run: ${orderCount}, items: ${orderItemCount})`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
