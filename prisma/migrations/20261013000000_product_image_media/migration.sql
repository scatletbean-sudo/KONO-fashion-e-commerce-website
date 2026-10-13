-- Additive only: preserve every existing image ID, URL, alt, order and primary flag.
BEGIN;
CREATE TYPE "ProductImageType" AS ENUM ('FRONT_VIEW', 'BACK_VIEW', 'LEFT_VIEW', 'RIGHT_VIEW', 'DETAIL', 'ON_MODEL', 'MULTI_VIEW', 'SIZE_CHART', 'PRODUCT', 'LIFESTYLE');

ALTER TABLE "ProductImage"
  ADD COLUMN "imageType" "ProductImageType" NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN "cloudinaryPublicId" TEXT,
  ADD COLUMN "cloudinaryAssetId" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "bytes" INTEGER,
  ADD COLUMN "format" TEXT;

CREATE UNIQUE INDEX "ProductImage_cloudinaryPublicId_key" ON "ProductImage"("cloudinaryPublicId");
CREATE UNIQUE INDEX "ProductImage_cloudinaryAssetId_key" ON "ProductImage"("cloudinaryAssetId");
COMMIT;
