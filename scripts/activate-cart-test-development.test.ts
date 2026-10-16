import test from "node:test";
import assert from "node:assert/strict";
import { assertTarget, assertAsset, assertVariants, fixtures } from "./activate-cart-test-development";
const productId = "test-cart-55cfed3e-9e64-4cd9-a530-cd3bf81d77aa";
const publicId = `kono/products/${productId}/offline`;
const url = `https://res.cloudinary.com/offline-cloud/image/upload/v1/${publicId}.png`;
const image = { productId, imageType: "MULTI_VIEW", isPrimary: true, cloudinaryPublicId: publicId, cloudinaryAssetId: "offline-asset", url, bytes: 1234, width: 1536, height: 1024, format: "png" };
const asset = { public_id: publicId, asset_id: "offline-asset", secure_url: url, resource_type: "image", type: "upload", bytes: 1234, width: 1536, height: 1024, format: "png", version: 1 };
test("activation is pinned to the exact TEST product and price", () => {
  const product = { id: productId, name: "KONO CART INTEGRATION TEST", slug: "test-kono-cart-integration-dev2", basePrice: 899000, status: "DRAFT" };
  assert.doesNotThrow(() => assertTarget(product));
  for (const patch of [{ id: "cmuedw86k0000q0ufukh57s7m" }, { status: "ARCHIVED" }, { basePrice: 1 }, { name: "Real product" }]) assert.throws(() => assertTarget({ ...product, ...patch }));
});
test("Cloudinary verification requires matching identity, ownership, metadata and canonical original", () => {
  assert.doesNotThrow(() => assertAsset(image, asset, "offline-cloud"));
  for (const patch of [{ public_id: "kono/products/other/offline" }, { asset_id: "wrong" }, { bytes: 123 }, { secure_url: url.replace("/v1/", "/c_crop/v1/") }, { resource_type: "video" }]) assert.throws(() => assertAsset(image, { ...asset, ...patch }, "offline-cloud"));
  assert.throws(() => assertAsset({ ...image, productId: "other" }, asset, "offline-cloud"));
});
test("fixture verifies all three exact statuses, prices and net inventories without resetting drift", () => {
  const variants = fixtures.map(row => ({ productId, sku: `TEST-CART-DEV2-BLK-${row.size}`, color: "Black", size: row.size, isActive: row.isActive, priceOverride: 899000, quantity: row.quantity, reserved: 0, lowStockAt: 0 }));
  assert.doesNotThrow(() => assertVariants(variants));
  for (const patch of [{ reserved: 1 }, { quantity: 99 }, { isActive: false }, { priceOverride: 1 }]) assert.throws(() => assertVariants(variants.map((row, i) => i === 0 ? { ...row, ...patch } : row)));
  assert.throws(() => assertVariants(variants.slice(0, 2)));
});
