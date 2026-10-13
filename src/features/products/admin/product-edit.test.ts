import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { sourceLoader } from "@/lib/testing/load-source";
import { updateProductSchema } from "../schemas/product.schema";
import { editableProductSchema, parseProductEdit, productAttributeOptions, productFormValues } from "./product-edit";
import { attributeErrorResponse } from "@/lib/admin/api/attribute-errors";

const original = {
  id: "p", name: "KONO Cargo", slug: "kono-cargo", description: "Original", basePrice: 590000, status: "DRAFT" as "DRAFT" | "ACTIVE" | "ARCHIVED",
  categories: [{ categoryId: "cat", category: { id: "cat", name: "Pants", isActive: true } }],
  collections: [],
  images: [{ id: "image", url: "https://example.com/pants.jpg", alt: "Pants", sortOrder: 4, isPrimary: true }],
  variants: [{ id: "v", productId: "p", sku: "KONO-M", colorId: "black", sizeId: "m", color: { id: "black", name: "Black" }, size: { id: "m", name: "M" },
    priceOverride: 620000, costPrice: 100000, barcode: "barcode", isActive: true, inventory: { id: "inventory", quantity: 5, reserved: 1, lowStockAt: 2 } }],
};
test("edit hydration and minimal PATCH preserve gallery, variant IDs, disabled status and inventory", () => {
  const product = editableProductSchema.parse({ ...original, variants: [{ ...original.variants[0], isActive: false }] });
  const form = productFormValues(product);
  assert.equal(form.variants[0].priceOverride, "620000");
  assert.equal(form.images[0].url, original.images[0].url);
  const title = parseProductEdit({ ...form, name: "Updated" }, product.status, product);
  assert.equal(title.success, true);
  if (title.success) assert.deepEqual(title.data, { id: "p", name: "Updated" });
  const variant = parseProductEdit({ ...form, variants: [{ ...form.variants[0], sku: "NEW-SKU" }] }, product.status, product);
  assert.equal(variant.success, true);
  if (variant.success) {
    const body = variant.data as { variants: Record<string, unknown>[] };
    assert.equal(body.variants[0].id, "v"); assert.equal(body.variants[0].isActive, false);
    for (const key of ["images", "inventory", "costPrice", "barcode"]) assert.equal(JSON.stringify(body).includes(`"${key}"`), false);
  }
  const untouched = parseProductEdit(form, product.status, product);
  assert.equal(untouched.success, true);
  if (untouched.success) assert.deepEqual(untouched.data, { id: "p" });
  for (const patch of [{ colorId: "" }, { sizeId: "" }, { priceOverride: "" }]) assert.equal(parseProductEdit({ ...form, variants: [{ ...form.variants[0], ...patch }] }, product.status, product).success, false);
  const parsed = updateProductSchema.parse({ id: "p", variants: [{ id: "v", sku: "NEW" }] });
  assert.equal(parsed.variants?.[0].isActive, undefined, "omitted flags must not enable disabled variants");
});
test("current inactive attributes remain selectable while unrelated inactive entries are excluded", () => {
  const product = editableProductSchema.parse({ ...original, categories: [{ categoryId: "cat", category: { ...original.categories[0].category, isActive: false } }] });
  const options = productAttributeOptions("categories", [{ id: "cat", name: "Pants", isActive: false }, { id: "other", name: "Other", isActive: false }, { id: "new", name: "New", isActive: true }], product);
  assert.deepEqual(options.map(option => option.id), ["new", "cat"]);
  assert.equal(options[1].isActive, false);
});

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
function fixture(change: (product: typeof original) => void = () => {}, concurrentStock = false) {
  const product = structuredClone(original); change(product);
  const writes: string[] = []; const locks: string[] = [];
  const categories = new Map([["cat", product.categories[0]?.category ?? { id: "cat", name: "Pants", isActive: true }], ["inactive", { id: "inactive", name: "Inactive", isActive: false }], ["new", { id: "new", name: "New", isActive: true }]]);
  let inTransaction = false;
  const db = {
    $queryRaw: async (query: { sql: string }) => {
      assert.equal(inTransaction, true); locks.push(query.sql);
      if (concurrentStock && query.sql.includes('"Inventory"')) product.variants[0].inventory.reserved = product.variants[0].inventory.quantity;
      return [];
    },
    product: {
      findUnique: async (query: { where: { id?: string; slug?: string } }) => query.where.id === "p" || query.where.slug === product.slug ? structuredClone(product) : null,
      update: async (query: { data: Partial<typeof original> }) => { assert.equal(inTransaction, true); writes.push("product.update"); Object.assign(product, query.data); return structuredClone(product); },
    },
    category: { findMany: async (query: { where: { id: { in: string[] }; isActive: boolean } }) => query.where.id.in.filter(id => categories.get(id)?.isActive === query.where.isActive).map(id => ({ id })) },
    collection: { findMany: async () => [] },
    color: { findMany: async (query: { where: { id: { in: string[] } } }) => query.where.id.in.filter(id => id === "black").map(id => ({ id })) },
    size: { findMany: async (query: { where: { id: { in: string[] } } }) => query.where.id.in.filter(id => id === "m").map(id => ({ id })) },
    productVariant: {
      findFirst: async (query: { where: { id: string; productId: string } }) => product.variants.find(variant => variant.id === query.where.id && variant.productId === query.where.productId) ?? null,
      update: async (query: { where: { id: string }; data: Record<string, unknown> }) => { writes.push("variant.update"); const item = product.variants.find(variant => variant.id === query.where.id)!; Object.assign(item, Object.fromEntries(Object.entries(query.data).filter(([, value]) => value !== undefined))); return item; },
    },
    productImage: { deleteMany: async () => { throw new Error("gallery deletion forbidden"); } },
    inventory: { upsert: async () => { throw new Error("inventory mutation forbidden"); } },
    productCategory: { deleteMany: async () => { writes.push("categories.replace"); product.categories = []; }, createMany: async (query: { data: { categoryId: string }[] }) => { product.categories = query.data.map(link => ({ categoryId: link.categoryId, category: categories.get(link.categoryId)! })); } },
  };
  const prisma = { ...db, $transaction: async (callback: (tx: unknown) => Promise<unknown>) => { inTransaction = true; try { return await callback(db); } finally { inTransaction = false; } } };
  const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma }, "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) } });
  const patch = load("src/app/api/admin/products/[id]/route.ts").PATCH as Handler;
  return { product, writes, locks, patch: (data: unknown) => patch(new Request("http://localhost/api/admin/products/p", { method: "PATCH", body: JSON.stringify(data) }), { params: Promise.resolve({ id: "p" }) }) };
}
for (const [label, change, expected] of [
  ["missing images", (p: typeof original) => { p.images = []; }, /valid product image/],
  ["invalid image URL", (p: typeof original) => { p.images[0].url = "javascript:alert(1)"; }, /valid product image/],
  ["missing variants", (p: typeof original) => { p.variants = []; }, /enabled variant/],
  ["disabled variants", (p: typeof original) => { p.variants[0].isActive = false; }, /enabled variant/],
  ["out of stock", (p: typeof original) => { p.variants[0].inventory.quantity = 1; }, /available inventory/],
  ["invalid variant price", (p: typeof original) => { p.variants[0].priceOverride = -1; }, /valid price/],
  ["invalid selling price", (p: typeof original) => { p.basePrice = -1; }, /selling price/],
  ["missing categories", (p: typeof original) => { p.categories = []; }, /active category/],
  ["inactive category", (p: typeof original) => { p.categories[0].category.isActive = false; }, /inactive ID/],
] as const) {
  test(`activation rejects ${label} before writes`, async () => {
    const f = fixture(change);
    const response = await f.patch({ status: "ACTIVE" });
    assert.equal(response.status, 400); assert.match((await response.json()).message, expected);
    assert.deepEqual(f.writes, []); assert.equal(f.product.status, "DRAFT");
  });
}
test("DRAFT and ARCHIVED activation succeeds with locks and leaves inventory/gallery unchanged", async () => {
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    const f = fixture(product => { product.status = status; });
    const inventory = structuredClone(f.product.variants[0].inventory); const gallery = structuredClone(f.product.images);
    assert.equal((await f.patch({ status: "ACTIVE" })).status, 200);
    assert.equal(f.product.status, "ACTIVE"); assert.deepEqual(f.product.variants[0].inventory, inventory); assert.deepEqual(f.product.images, gallery);
    assert.ok(f.locks.some(sql => sql.includes('"ProductVariant"') && sql.includes("FOR SHARE")));
    assert.ok(f.locks.some(sql => sql.includes('"Inventory"') && sql.includes("FOR UPDATE OF i")));
    assert.deepEqual(f.writes, ["product.update"]);
  }
});
test("activation reads inventory after taking the lock and rejects a concurrent reservation that exhausts stock", async () => {
  const f = fixture(() => {}, true);
  const response = await f.patch({ status: "ACTIVE" });
  assert.equal(response.status, 400); assert.match((await response.json()).message, /available inventory/);
  assert.deepEqual(f.writes, []); assert.equal(f.product.status, "DRAFT");
});
test("legacy ACTIVE products and incomplete DRAFT products remain editable without implicit transitions", async () => {
  for (const status of ["DRAFT", "ACTIVE"] as const) {
    const f = fixture(product => { product.status = status; product.images = []; product.variants = []; product.categories[0].category.isActive = false; });
    assert.equal((await f.patch({ name: "Edited" })).status, 200);
    assert.equal(f.product.status, status); assert.equal(f.product.categories[0].category.isActive, false);
  }
});
test("PATCH preserves disabled variants/inventory and rejects new inactive or missing IDs and foreign variant IDs", async () => {
  const f = fixture(product => { product.variants[0].isActive = false; });
  const inventory = structuredClone(f.product.variants[0].inventory);
  assert.equal((await f.patch({ variants: [{ id: "v", sku: "NEW-SKU" }] })).status, 200);
  assert.equal(f.product.variants[0].isActive, false); assert.deepEqual(f.product.variants[0].inventory, inventory);
  for (const body of [{ categoryIds: ["missing"] }, { categoryIds: ["inactive"] }, { variants: [{ id: "foreign", sku: "F" }] }, { variants: [{ id: "v", sku: "NEW-SKU", colorId: "missing" }] }]) {
    const previous = f.writes.length;
    assert.equal((await f.patch(body)).status, 400); assert.equal(f.writes.length, previous);
  }
});
test("activation refuses inline inventory writes and invalid incoming prices; API rejects unauthorized PATCH", async () => {
  const f = fixture();
  assert.equal((await f.patch({ status: "ACTIVE", variants: [{ id: "v", sku: "KONO-M", inventory: { quantity: 100 } }] })).status, 400);
  assert.equal((await f.patch({ status: "ACTIVE", basePrice: -1 })).status, 400);
  assert.deepEqual(f.writes, []);
  const load = sourceLoader({ "@/lib/auth/admin-guard": { getAdminSession: async () => null }, "@/features/products/services/product.service": { productService: {} } });
  const req = new Request("http://localhost/api/admin/products/p", { method: "PATCH" }); req.json = async () => { throw new Error("body must not be read"); };
  assert.equal((await (load("src/app/api/admin/products/[id]/route.ts").PATCH as Handler)(req, { params: Promise.resolve({ id: "p" }) })).status, 401);
});
test("validity is checked against prospective edited values and zero-price follows the existing nonnegative price contract", async () => {
  const f = fixture(product => { product.variants[0].priceOverride = -1; });
  assert.equal((await f.patch({ status: "ACTIVE", variants: [{ id: "v", sku: "KONO-M", priceOverride: 0 }] })).status, 200);
  assert.equal(f.product.variants[0].priceOverride, 0);
  assert.equal(f.product.status, "ACTIVE");
});
test("editing preserves existing inactive category links and only accepts ACTIVE categories for newly selected IDs", async () => {
  const f = fixture(product => { product.categories[0].category.isActive = false; });
  assert.equal((await f.patch({ categoryIds: ["cat", "new"] })).status, 200);
  assert.equal(f.product.categories[0].category.isActive, false);
  assert.equal(f.product.categories[1].category.isActive, true);
});
test("transaction conflicts/timeouts return a retry message without exposing internal details", async () => {
  for (const code of ["P2034", "P2028"]) {
    const response = attributeErrorResponse({ code, message: "internal-sensitive-diagnostic" })!;
    assert.equal(response.status, 409);
    const body = await response.json(); assert.match(body.message, /Reload and try again/);
    assert.equal(JSON.stringify(body).includes("internal-sensitive"), false);
  }
});
