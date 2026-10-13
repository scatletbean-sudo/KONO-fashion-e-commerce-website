-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('FRONT_VIEW', 'BACK_VIEW', 'LEFT_VIEW', 'RIGHT_VIEW', 'DETAIL', 'ON_MODEL', 'MULTI_VIEW', 'SIZE_CHART', 'PRODUCT', 'LIFESTYLE');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "cloudinaryAssetId" TEXT,
ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "imageType" "ProductImageType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "width" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_cloudinaryPublicId_key" ON "ProductImage"("cloudinaryPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_cloudinaryAssetId_key" ON "ProductImage"("cloudinaryAssetId");

