import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { inventoryValuesSchema } from "./schemas/inventory-values.schema";
import { createInventorySchema } from "./schemas/inventory.schema";
import { createVariantSchema, updateVariantSchema } from "../products/variants/schemas/variant.schema";
import { createProductSchema, updateProductSchema } from "../products/schemas/product.schema";
import { sourceLoader } from "@/lib/testing/load-source";
import type { productService as ProductService } from "../products/services/product.service";
import type { variantService as VariantService } from "../products/variants/services/variant.service";
import type { inventoryService as InventoryService } from "./services/inventory.service";

test("shared inventory validation accepts boundaries and rejects invalid values on all creation paths", () => {
  assert.deepEqual(inventoryValuesSchema.parse({}), { quantity: 0, reserved: 0, lowStockAt: 5 });
  assert.equal(inventoryValuesSchema.safeParse({ quantity: 2, reserved: 2 }).success, true);
  for (const inventory of [{ quantity: 1, reserved: 2 }, { quantity: -1 }, { reserved: -1 }, { quantity: 1.5 }, { quantity: NaN }, { lowStockAt: -1 }]) {
    assert.equal(inventoryValuesSchema.safeParse(inventory).success, false);
    assert.equal(createInventorySchema.safeParse({ variantId: "v", ...inventory }).success, false);
    assert.equal(createVariantSchema.safeParse({ productId: "p", sku: "SKU", inventory }).success, false);
    assert.equal(createProductSchema.safeParse({ name: "Shirt", slug: "shirt", basePrice: 100, variants: [{ sku: "SKU", inventory }] }).success, false);
    assert.equal(updateProductSchema.safeParse({ id: "p", variants: [{ id: "v", sku: "SKU", inventory }] }).success, false);
  }
});

test("variant PATCH rejects unsupported fields, even mixed with valid fields", () => {
  for (const fields of [{ inventory: { quantity: 5 } }, { productId: "other" }, { unknown: true }]) {
    assert.equal(updateVariantSchema.safeParse({ id: "v", ...fields }).success, false);
    assert.equal(updateVariantSchema.safeParse({ id: "v", sku: "NEW", ...fields }).success, false);
  }
  assert.equal(updateVariantSchema.safeParse({ id: "v" }).success, false);
  assert.equal(updateVariantSchema.safeParse({ id: "v", isActive: false }).success, true);
});

function fixture() {
  const calls: { name: string; data: unknown }[] = [];
  const record = (name: string, data: unknown) => { calls.push({ name, data }); return data; };
  const inventory = { id: "i", variantId: "v", quantity: 10, reserved: 8, lowStockAt: 5 };
  const tx = {
    product: { update: async (data: unknown) => record("product.update", data) },
    productVariant: { findFirst: async () => ({ id: "v" }), update: async (data: unknown) => record("variant.update", data), create: async (data: unknown) => record("variant.create", data) },
    inventory: { upsert: async (data: unknown) => record("inventory.upsert", data) },
  };
  const repositories = {
    productRepository: { findById: async () => ({ id: "p" }), findBySlug: async () => null,
      create: async (data: unknown) => record("product.create", data),
      transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
    variantRepository: { findById: async () => ({ id: "v", inventory }), findBySku: async () => null,
      create: async (data: unknown) => record("variant.create", data), update: async (_id: string, data: unknown) => record("variant.update", data) },
    inventoryRepository: { findById: async () => inventory, findByVariantId: async () => null,
      create: async (data: unknown) => record("inventory.create", data), update: async (_id: string, data: unknown) => record("inventory.update", data) },
  };
  const load = sourceLoader(Object.fromEntries([
    [path.resolve("src/features/products/repositories/product.repository"), { productRepository: repositories.productRepository }],
    [path.resolve("src/features/products/variants/repositories/variant.repository"), { variantRepository: repositories.variantRepository }],
    [path.resolve("src/features/inventory/repositories/inventory.repository"), { inventoryRepository: repositories.inventoryRepository }],
  ]));
  return { calls, load,
    product: load("src/features/products/services/product.service.ts").productService as typeof ProductService,
    variant: load("src/features/products/variants/services/variant.service.ts").variantService as typeof VariantService,
    inventory: load("src/features/inventory/services/inventory.service.ts").inventoryService as typeof InventoryService };
}

test("real product/variant/inventory services reject invalid inventory without writes", async () => {
  const f = fixture();
  const invalid = { quantity: 1, reserved: 2, lowStockAt: 5 };
  const product = createProductSchema.parse({ name: "Shirt", slug: "shirt", basePrice: 100, variants: [{ sku: "SKU", inventory: { quantity: 2 } }] });
  product.variants[0].inventory = invalid;
  await assert.rejects(f.product.createProduct(product));
  await assert.rejects(f.product.updateProduct({ id: "p", variants: product.variants }));
  const variant = createVariantSchema.parse({ productId: "p", sku: "SKU", inventory: { quantity: 2 } });
  variant.inventory = invalid;
  await assert.rejects(f.variant.createVariant(variant));
  await assert.rejects(f.inventory.createInventory({ variantId: "v", ...invalid }));
  await assert.rejects(f.inventory.updateInventory("i", { quantity: 7 }));
  await assert.rejects(f.variant.updateInventory("v", 7));
  await assert.rejects(f.variant.updateInventory("v", 10.5));
  assert.equal(f.calls.length, 0);
});

test("real services persist valid inventory and merge partial updates with existing reserved stock", async () => {
  const f = fixture();
  await f.inventory.updateInventory("i", { quantity: 8 });
  await f.variant.updateInventory("v", 8);
  await f.variant.createVariant(createVariantSchema.parse({ productId: "p", sku: "SKU", inventory: { quantity: 2, reserved: 1 } }));
  await f.product.createProduct(createProductSchema.parse({ name: "Shirt", slug: "shirt", basePrice: 100, variants: [{ sku: "SKU", inventory: { quantity: 2, reserved: 1 } }] }));
  await f.product.updateProduct(updateProductSchema.parse({ id: "p", variants: [{ id: "v", sku: "SKU", inventory: { quantity: 2, reserved: 1 } }, { sku: "NEW", inventory: { quantity: 3, reserved: 2 } }] }));
  assert.ok(f.calls.some((call) => call.name === "inventory.upsert"));
  assert.ok(f.calls.some((call) => call.name === "variant.create"));
  const upsert = f.calls.find((call) => call.name === "inventory.upsert")!.data as { update: { quantity: number; reserved: number } };
  assert.equal(upsert.update.quantity, 2);
  assert.equal(upsert.update.reserved, 1);
});

test("real variant service rejects unsupported PATCH data and persists supported fields", async () => {
  const f = fixture();
  const data = { id: "v", sku: "NEW", inventory: { quantity: 4 } };
  await assert.rejects(f.variant.updateVariant(data));
  assert.equal(f.calls.length, 0);
  await f.variant.updateVariant({ id: "v", sku: "NEW", isActive: false });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].data)), { sku: "NEW", isActive: false });
});

test("variant PATCH route returns 400 for ignored fields using real schema and service", async () => {
  const f = fixture();
  const load = sourceLoader({
    "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
    "@/features/products/variants/services/variant.service": { variantService: f.variant },
  });
  const handler = load("src/app/api/products/variants/[id]/route.ts").PATCH as (req: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  for (const fields of [{ inventory: { quantity: 2 } }, { productId: "other" }, { unknown: true }]) {
    const response = await handler(new Request("http://localhost/api/products/variants/v", { method: "PATCH", body: JSON.stringify({ sku: "NEW", ...fields }) }), { params: Promise.resolve({ id: "v" }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, "Validation failed");
  }
  assert.deepEqual(f.calls, []);
});
