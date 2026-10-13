import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { imageTypes, imageTypeSchema, mediaImageSchema } from "./media-policy";
import { createProductImageSchema, updateProductImageSchema } from "./schemas/product-image.schema";
import { productSchema } from "@/components/storefront/catalog";

test("all requested image types and compatibility types agree across schema, pending SQL and client", () => {
  const required = ["FRONT_VIEW", "BACK_VIEW", "LEFT_VIEW", "RIGHT_VIEW", "DETAIL", "ON_MODEL", "MULTI_VIEW", "SIZE_CHART"];
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const sql = readFileSync("prisma/migrations/20261013000000_product_image_media/migration.sql", "utf8");
  const prismaTypes = schema.match(/enum ProductImageType\s*\{([^}]+)\}/)![1].trim().split(/\s+/);
  const sqlTypes = [...sql.match(/CREATE TYPE "ProductImageType" AS ENUM \(([^)]+)\)/)![1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(prismaTypes, [...imageTypes]); assert.deepEqual(sqlTypes, [...imageTypes]);
  for (const type of [...required, "PRODUCT", "LIFESTYLE"]) {
    assert.equal(imageTypeSchema.parse(type), type);
    assert.equal(createProductImageSchema.parse({ productId: "p", publicId: "kono/products/p/a", uploadToken: "synthetic", imageType: type }).imageType, type);
    assert.equal(updateProductImageSchema.parse({ id: "i", imageType: type }).imageType, type);
  }
});

test("pending migration is atomic and additive; no mutation of legacy image columns or related tables", () => {
  const sql = readFileSync("prisma/migrations/20261013000000_product_image_media/migration.sql", "utf8").replace(/--[^\n]*/g, "");
  assert.ok(sql.trim().startsWith("BEGIN;")); assert.ok(sql.trim().endsWith("COMMIT;"));
  assert.equal(/\b(?:DROP|DELETE|TRUNCATE|UPDATE|INSERT|RENAME)\b/i.test(sql), false);
  assert.equal(/ALTER TABLE "(?:Order|Payment|Inventory|Product)"/.test(sql), false);
  assert.equal((sql.match(/ADD COLUMN/g) ?? []).length, 7);
  for (const column of ["id", "productId", "url", "alt", "sortOrder", "isPrimary", "createdAt"]) assert.equal(sql.includes(`ADD COLUMN "${column}"`), false);
  assert.ok(sql.includes("NOT NULL DEFAULT 'PRODUCT'"));
  assert.equal((sql.match(/CREATE UNIQUE INDEX/g) ?? []).length, 2);
});

test("legacy rows stay unclassified PRODUCT; optional public imageType preserves old and new catalog contracts", () => {
  const legacy = { id: "i", productId: "p", url: "https://legacy.example/original.jpg", alt: "Old", sortOrder: 5, isPrimary: false };
  assert.equal(mediaImageSchema.parse(legacy).imageType, "PRODUCT");
  const product = { id: "p", name: "KONO", slug: "kono", basePrice: 100, variants: [], images: [legacy] };
  assert.equal(productSchema.parse(product).images[0].url, legacy.url);
  for (const imageType of imageTypes) assert.equal(productSchema.parse({ ...product, images: [{ ...legacy, imageType }] }).images[0].imageType, imageType);
});
