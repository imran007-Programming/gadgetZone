-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingZone" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "advanceOutsideDhaka" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bkashNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "deliveryFeeInsideDhaka" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "deliveryFeeOutsideDhaka" INTEGER NOT NULL DEFAULT 99,
ADD COLUMN     "nagadNumber" TEXT NOT NULL DEFAULT '';
