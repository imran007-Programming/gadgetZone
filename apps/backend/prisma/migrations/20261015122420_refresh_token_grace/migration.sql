-- AlterTable
ALTER TABLE "User" ADD COLUMN     "prevRefreshTokenHash" TEXT,
ADD COLUMN     "refreshRotatedAt" TIMESTAMP(3);
