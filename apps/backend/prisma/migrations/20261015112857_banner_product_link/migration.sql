-- AlterTable
ALTER TABLE "Banner" DROP COLUMN "ctaLabel",
DROP COLUMN "eyebrow",
DROP COLUMN "subtitle",
ADD COLUMN     "productId" TEXT;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

