import assert from "node:assert/strict";
import test from "node:test";
import { catalogError, catalogResponse, publicCatalogData } from "./public-catalog";

const variant = { id: "v1", isActive: true, sku: "SKU", costPrice: 123, barcode: "internal", priceOverride: 200,
  inventory: { quantity: 5, reserved: 4, lowStockAt: 2 }, product: { status: "ACTIVE" },
  color: { id: "c1", name: "Black", variants: [{ costPrice: 123 }] }, size: { name: "M", variants: [{ costPrice: 123 }] } };
const product = { id: "p1", name: "Shirt", status: "ACTIVE", basePrice: 200, internalField: "private",
  variants: [variant, { ...variant, id: "inactive", isActive: false }],
  images: [{ url: "/shirt.jpg", product: { internalField: "private" } }],
  categories: [{ category: { id: "cat", isActive: true } }, { category: { isActive: false } }] };

test("public product allowlist removes internal fields at every relation", () => {
  const data = publicCatalogData("products", product);
  assert.deepEqual(data, { id: "p1", name: "Shirt", basePrice: 200,
    images: [{ url: "/shirt.jpg" }],
    variants: [{ id: "v1", sku: "SKU", priceOverride: 200, color: { id: "c1", name: "Black" }, size: { name: "M" }, inStock: true }],
    categories: [{ category: { id: "cat" } }] });
  assert.equal(product.variants[0].costPrice, 123, "projection must not mutate admin data");
});

test("public catalog hides drafts, archived products and disabled variants", () => {
  assert.deepEqual(publicCatalogData("products", [product, { ...product, status: "DRAFT" }, { ...product, status: "ARCHIVED" }]), [publicCatalogData("products", product)]);
  assert.equal(publicCatalogData("variants", { ...variant, product: { status: "DRAFT" } }), null);
  assert.equal(publicCatalogData("variants", { ...variant, isActive: false }), null);
  assert.equal(publicCatalogData("images", { url: "/draft.jpg", product: { status: "DRAFT" } }), null);
});

test("category and collection relations hide inactive entries and private product fields", () => {
  for (const resource of ["categories", "collections"] as const) {
    assert.deepEqual(publicCatalogData(resource, { id: "group", isActive: true, products: [{ product }, { product: { status: "DRAFT" } }] }),
      { id: "group", products: [{ product: publicCatalogData("products", product) }] });
    assert.equal(publicCatalogData(resource, { isActive: false }), null);
  }
  assert.deepEqual(publicCatalogData("categories", { isActive: true, parent: { isActive: false }, children: [{ id: "child", isActive: true }, { isActive: false }] }), { parent: null, children: [{ id: "child" }] });
});

test("size and color endpoints do not expose variant relations", () => {
  assert.deepEqual(publicCatalogData("sizes", { id: "s", name: "M", variants: [variant] }), { id: "s", name: "M" });
  assert.deepEqual(publicCatalogData("colors", { id: "c", hexCode: "#000000", variants: [variant] }), { id: "c", hexCode: "#000000" });
});

test("availability exposes a boolean without warehouse quantities", () => {
  for (const inventory of [null, { quantity: 4, reserved: 4 }, { quantity: 1, reserved: 3 }]) {
    assert.equal((publicCatalogData("variants", { ...variant, inventory }) as Record<string, unknown>).inStock, false);
  }
});

test("catalog responses always use public data and are uncached", async () => {
  const admin = catalogResponse("products", product);
  assert.deepEqual((await admin.json()).data, publicCatalogData("products", product));
  assert.equal(admin.headers.get("cache-control"), "private, no-store");
  const hidden = catalogResponse("products", { status: "DRAFT", costPrice: 123 });
  assert.equal(hidden.status, 404);
  assert.deepEqual(await hidden.json(), { success: false, message: "Not found" });
});

test("public errors do not disclose database details", async () => {
  const response = catalogError(new Error("Internal database configuration details"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, message: "Failed to load catalog" });
  assert.equal(catalogError(new Error("Product not found")).status, 404);
  assert.equal(catalogError(new Error("Variant ID is required")).status, 400);
});
