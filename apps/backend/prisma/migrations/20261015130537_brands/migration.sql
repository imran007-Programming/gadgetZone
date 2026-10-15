-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandId" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed brands for the current catalog and link products by name prefix
INSERT INTO "Brand" ("id", "name", "slug", "updatedAt") VALUES
  ('brand_amazon', 'Amazon', 'amazon', CURRENT_TIMESTAMP),
  ('brand_anker', 'Anker', 'anker', CURRENT_TIMESTAMP),
  ('brand_apple', 'Apple', 'apple', CURRENT_TIMESTAMP),
  ('brand_belkin', 'Belkin', 'belkin', CURRENT_TIMESTAMP),
  ('brand_dji', 'DJI', 'dji', CURRENT_TIMESTAMP),
  ('brand_fitbit', 'Fitbit', 'fitbit', CURRENT_TIMESTAMP),
  ('brand_gopro', 'GoPro', 'gopro', CURRENT_TIMESTAMP),
  ('brand_google', 'Google', 'google', CURRENT_TIMESTAMP),
  ('brand_jbl', 'JBL', 'jbl', CURRENT_TIMESTAMP),
  ('brand_logitech', 'Logitech', 'logitech', CURRENT_TIMESTAMP),
  ('brand_nintendo', 'Nintendo', 'nintendo', CURRENT_TIMESTAMP),
  ('brand_philips', 'Philips', 'philips', CURRENT_TIMESTAMP),
  ('brand_razer', 'Razer', 'razer', CURRENT_TIMESTAMP),
  ('brand_samsung', 'Samsung', 'samsung', CURRENT_TIMESTAMP),
  ('brand_sony', 'Sony', 'sony', CURRENT_TIMESTAMP),
  ('brand_xiaomi', 'Xiaomi', 'xiaomi', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Product" p SET "brandId" = b."id"
FROM "Brand" b
WHERE p."brandId" IS NULL AND lower(p."name") LIKE lower(b."name") || ' %';
