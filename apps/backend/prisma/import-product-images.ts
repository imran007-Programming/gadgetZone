/**
 * Attaches Cloudinary-hosted gallery images to the seeded products.
 *
 * Put the photos in one folder per product slug:
 *   apps/backend/product-images/<product-slug>/1.jpg
 *   apps/backend/product-images/<product-slug>/2.png
 *   ...
 * Files are uploaded in natural name order; the first one becomes the cover.
 *
 * Products that already have gallery images are skipped, so the script can be
 * re-run safely after adding more folders. Run with: npm run images:import
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

try {
  // Node reads apps/backend/.env the same way the API does
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment
}

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET first.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();
const IMAGE_ROOT = path.resolve('product-images');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

async function listImages(dir: string): Promise<string[]> {
  try {
    const names = (await readdir(dir)).filter((n) => IMAGE_EXT.test(n));
    names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return names.map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, _count: { select: { images: true } } },
    orderBy: { slug: 'asc' },
  });

  let attached = 0;
  let alreadyDone = 0;
  let uploadedCount = 0;
  const noFolder: string[] = [];

  for (const product of products) {
    const files = await listImages(path.join(IMAGE_ROOT, product.slug));
    if (files.length === 0) {
      noFolder.push(product.slug);
      continue;
    }
    if (product._count.images > 0) {
      alreadyDone++;
      continue;
    }

    const folder = `gadgetlax/products/${product.slug}`;
    const uploaded: { url: string; publicId: string }[] = [];
    for (const file of files) {
      const res = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: 'image',
      });
      uploaded.push({ url: res.secure_url, publicId: res.public_id });
    }
    uploadedCount += uploaded.length;

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

    attached++;
    console.log(`✔ ${product.slug}: ${uploaded.length} image(s)`);
  }

  console.log('\nImage import complete:');
  console.log(`  products updated: ${attached} (${uploadedCount} images uploaded)`);
  console.log(`  already had images, skipped: ${alreadyDone}`);
  console.log(`  no image folder: ${noFolder.length}`);
  if (noFolder.length) {
    console.log(`    e.g. ${noFolder.slice(0, 10).join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error('Image import failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
