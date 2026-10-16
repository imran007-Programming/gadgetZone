-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "topbarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "topbarLeftTitle" TEXT NOT NULL DEFAULT 'Corporate & Wholesale',
    "topbarLeftText" TEXT NOT NULL DEFAULT 'Get Special Business Pricing',
    "topbarLeftLink" TEXT NOT NULL DEFAULT '/help',
    "announcement" TEXT NOT NULL DEFAULT '',
    "announcementLink" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

