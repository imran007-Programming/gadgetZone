-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_isActive_position_idx" ON "Banner"("isActive", "position");

-- Keep the storefront looking the same: move the four built-in banners into the table
INSERT INTO "Banner" ("id", "eyebrow", "title", "subtitle", "ctaLabel", "ctaHref", "imageUrl", "position", "isActive", "updatedAt") VALUES
  ('banner_builtin_1', 'Premium Audio', 'Hear every detail', 'Headphones, earbuds & speakers — top-rated sound gear.', 'Shop Audio', '/products?category=audio', '/banners/banner-1.jpg', 0, true, CURRENT_TIMESTAMP),
  ('banner_builtin_2', 'Smartwatches', 'Time, upgraded', 'Smartwatches & fitness trackers for every lifestyle.', 'Shop Wearables', '/products?category=wearables', '/banners/banner-2.jpg', 1, true, CURRENT_TIMESTAMP),
  ('banner_builtin_3', 'Smart Home', 'Your home, smarter', 'Cameras, bulbs & plugs to automate everyday living.', 'Shop Smart Home', '/products?category=smart-home', '/banners/banner-3.jpg', 2, true, CURRENT_TIMESTAMP),
  ('banner_builtin_4', 'Power & Charging', 'Stay charged', 'Power banks, fast chargers & cables that keep up.', 'Shop Accessories', '/products?category=mobile-accessories', '/banners/banner-4.jpg', 3, true, CURRENT_TIMESTAMP);
