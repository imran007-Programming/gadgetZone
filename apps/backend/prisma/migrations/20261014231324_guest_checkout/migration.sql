-- AlterTable: make userId nullable, add guest fields + paymentMethod
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cod';
