-- REVIEW ONLY: not applied. No row backfill or inventory mutation.
-- customerEmail DROP NOT NULL relaxes metadata; no table/column/data is dropped.
-- Existing rows passed the READ ONLY checks on approved Development before preparation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Intentionally pinned to approved Neon Development. Never deploy to production.
DO $$
BEGIN
  IF current_database() <> 'neondb' OR current_schema() <> 'public'
    OR current_setting('neon.project_id', true) IS DISTINCT FROM 'hidden-forest-64993760'
    OR current_setting('neon.branch_id', true) IS DISTINCT FROM 'br-proud-field-b3xjljxh'
    OR current_setting('neon.endpoint_id', true) IS DISTINCT FROM 'ep-lucky-fire-b3froe7u'
    OR NOT EXISTS (SELECT 1 FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl)
  THEN RAISE EXCEPTION 'Checkout migration requires verified approved Neon Development with TLS';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('HELD', 'RELEASED', 'CONSUMED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "provinceName" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "wardCode" TEXT,
ADD COLUMN     "wardName" TEXT,
ALTER COLUMN "customerEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "sizeName" TEXT;

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "ownerHash" VARCHAR(64) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "quoteFingerprint" VARCHAR(64) NOT NULL,
    "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_orderId_key" ON "CheckoutAttempt"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_status_expiresAt_idx" ON "CheckoutAttempt"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_ownerHash_keyHash_key" ON "CheckoutAttempt"("ownerHash", "keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key" ON "InventoryReservation"("orderItemId");

-- CreateIndex
CREATE INDEX "InventoryReservation_inventoryId_status_idx" ON "InventoryReservation"("inventoryId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL-only CHECK constraints: Prisma schema cannot express these. Retain them in future diffs.
-- No values are rewritten. NOT VALID + VALIDATE checks existing rows and fails atomically.
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_values_check"
  CHECK (quantity >= 0 AND reserved >= 0 AND reserved <= quantity AND "lowStockAt" >= 0) NOT VALID;
ALTER TABLE "Inventory" VALIDATE CONSTRAINT "Inventory_values_check";

ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check"
  CHECK (subtotal >= 0 AND "discountAmount" >= 0 AND "shippingAmount" >= 0 AND "taxAmount" >= 0 AND "totalAmount" >= 0) NOT VALID;
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_money_check";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values_check"
  CHECK (quantity > 0 AND "unitPrice" >= 0 AND "totalPrice" >= 0 AND "totalPrice"::bigint = quantity::bigint * "unitPrice"::bigint) NOT VALID;
ALTER TABLE "OrderItem" VALIDATE CONSTRAINT "OrderItem_values_check";

-- All snapshot fields absent is legacy. New snapshots must be complete, nonempty and VN.
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipping_snapshot_check" CHECK (
  num_nonnulls("recipientName", "recipientPhone", "provinceCode", "provinceName", "wardCode", "wardName", "addressLine", "countryCode", "shippingMethod") = 0
  OR (
    num_nonnulls("recipientName", "recipientPhone", "provinceCode", "provinceName", "wardCode", "wardName", "addressLine", "countryCode", "shippingMethod") = 9
    AND length(btrim("recipientName")) > 0 AND length(btrim("recipientPhone")) > 0
    AND length(btrim("provinceCode")) > 0 AND length(btrim("provinceName")) > 0
    AND length(btrim("wardCode")) > 0 AND length(btrim("wardName")) > 0
    AND length(btrim("addressLine")) > 0 AND "countryCode" = 'VN' AND "shippingMethod" = 'STANDARD'
  )
) NOT VALID;
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_shipping_snapshot_check";

ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_hashes_check" CHECK (
  "ownerHash" ~ '^[a-f0-9]{64}$' AND "keyHash" ~ '^[a-f0-9]{64}$'
  AND "requestFingerprint" ~ '^[a-f0-9]{64}$' AND "quoteFingerprint" ~ '^[a-f0-9]{64}$'
);
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_state_check" CHECK (
  "expiresAt" > "createdAt" AND (
    (status = 'COMPLETED' AND "orderId" IS NOT NULL AND "completedAt" IS NOT NULL AND "completedAt" >= "createdAt")
    OR (status <> 'COMPLETED' AND "orderId" IS NULL AND "completedAt" IS NULL)
  )
);
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_quantity_check" CHECK (quantity > 0);
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_state_check" CHECK (
  "expiresAt" > "createdAt" AND (
    (status = 'HELD' AND "releasedAt" IS NULL AND "consumedAt" IS NULL)
    OR (status = 'RELEASED' AND "releasedAt" IS NOT NULL AND "releasedAt" >= "createdAt" AND "consumedAt" IS NULL)
    OR (status = 'CONSUMED' AND "consumedAt" IS NOT NULL AND "consumedAt" >= "createdAt" AND "releasedAt" IS NULL)
  )
);
COMMIT;
