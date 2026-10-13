import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { z } from "zod";
import { sourceLoader } from "@/lib/testing/load-source";
import { CatalogApiError, attributeListSchema, catalogRequest, draftFormSchema, emptyDraft, emptyProductFilters, filterProducts, inventorySummary, makeSlug, productListSchema, type DraftForm } from "./product-management";

const form: DraftForm = { ...emptyDraft, name: "KONO Cargo", slug: "kono-cargo", basePrice: "590000", categoryIds: ["cat"], collectionIds: ["col"], images: [], variants: [{ sku: "CARGO-M", colorId: "black", sizeId: "m", priceOverride: "" }] };
test("draft payload follows real create schema, includes relations and never invents inventory", () => {
  const data = draftFormSchema.parse(form);
  assert.equal(data.status, "DRAFT");
  assert.equal(data.basePrice, 590000);
  assert.equal(data.images.length, 0, "Upload verified images after saving the draft");
  assert.equal(data.variants[0].priceOverride, undefined);
  assert.equal("inventory" in data.variants[0], false);
  assert.deepEqual(data.categoryIds, ["cat"]);
  assert.equal(draftFormSchema.parse({ ...form, images: [], variants: [] }).variants.length, 0);
  assert.equal(draftFormSchema.parse({ ...form, status: "ACTIVE" }).status, "DRAFT");
});
test("required fields, price limits, image protocol, SKU and variant combinations are validated", () => {
  for (const patch of [{ name: " " }, { slug: "BAD SLUG" }, ...["", "-1", "1.5", "1e3", "2147483648"].map(basePrice => ({ basePrice })),
    ...["javascript:alert(1)", "ftp://example.com/a.jpg", "https://user:password@example.com/a.jpg", "invalid"].map(url => ({ images: [{ url, alt: "" }] })),
    { variants: [{ ...form.variants[0], sku: "" }] }, { variants: [form.variants[0], form.variants[0]] },
    { variants: [form.variants[0], { ...form.variants[0], sku: "OTHER" }] }]) {
    assert.equal(draftFormSchema.safeParse({ ...form, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(makeSlug("Quần Đen KONO V2"), "quan-den-kono-v2");
  assert.equal(draftFormSchema.parse({ ...form, variants: [{ ...form.variants[0], priceOverride: "0" }] }).variants[0].priceOverride, 0);
});
const product = { id: "p", name: "KONO Cargo", slug: "kono-cargo", status: "DRAFT" as const, basePrice: 590000, images: [], variants: [{ inventory: null }] };
test("list keeps drafts, searches name/slug, filters status and distinguishes absent/zero/partial stock", () => {
  assert.equal(filterProducts([product], " CARGO ", "ALL").length, 1);
  assert.equal(filterProducts([product], "kono-cargo", "DRAFT").length, 1);
  assert.equal(filterProducts([product], "", "ACTIVE").length, 0);
  assert.equal(inventorySummary(product), "Not tracked");
  assert.equal(inventorySummary({ ...product, variants: [{ inventory: { quantity: 0, reserved: 0 } }] }), "0 available");
  assert.equal(inventorySummary({ ...product, variants: [{ inventory: { quantity: 10, reserved: 3 } }, { inventory: null }] }), "7 available · 1 variant(s) not tracked");
});
test("category/collection filters intersect with search/status and color/size must match the same variant", () => {
  const related = productListSchema.parse([{ ...product,
    categories: [{ categoryId: "pants", category: { id: "pants", name: "Pants" } }],
    collections: [{ collectionId: "summer" }],
    variants: [{ colorId: "black", sizeId: "m", inventory: null }, { colorId: "white", sizeId: "l", inventory: null }],
  }, { ...product, id: "unrelated", categories: [], collections: [] }]);
  const filters = { categoryId: "pants", collectionId: "summer", colorId: "black", sizeId: "m" };
  assert.equal(filterProducts(related, "cargo", "DRAFT", filters).length, 1);
  for (const patch of [{ categoryId: "missing" }, { collectionId: "missing" }, { colorId: "missing" }, { sizeId: "l" }]) {
    assert.equal(filterProducts(related, "", "ALL", { ...filters, ...patch }).length, 0);
  }
  assert.equal(filterProducts(related, "cargo", "ACTIVE", filters).length, 0);
  assert.equal(filterProducts(related, "missing", "DRAFT", filters).length, 0);
  assert.equal(filterProducts(related, "", "ALL", { ...emptyProductFilters, sizeId: "l" }).length, 1);
  assert.equal(filterProducts(related, "", "ALL", { ...emptyProductFilters, colorId: "white" }).length, 1);
  assert.equal(filterProducts(related, "", "ALL", emptyProductFilters).length, 2);
  assert.equal(filterProducts([product], "", "ALL", filters).length, 0);
});
test("attribute schema preserves real ADMIN data without exposing nested private relations", async () => {
  const data = [{ id: "black", name: "Black", slug: "black", hexCode: "#000000", isActive: false, sortOrder: 2, variants: [{ costPrice: 100 }] }];
  const result = await catalogRequest("/api/admin/colors", attributeListSchema, {}, (async () => new Response(JSON.stringify({ success: true, data }))) as typeof fetch);
  assert.equal(result[0].hexCode, "#000000");
  assert.equal(result[0].isActive, false);
  assert.equal(result[0].slug, "black");
  assert.equal("variants" in result[0], false);
  assert.equal(attributeListSchema.parse([]).length, 0);
  assert.equal(attributeListSchema.safeParse([{ id: "missing-slug", name: "Incomplete" }]).success, false);
});
test("client handles real envelopes, authentication, field errors, conflicts and malformed responses with mock fetch", async () => {
  const mock = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  assert.equal((await catalogRequest("/api/admin/products", productListSchema, {}, mock(200, { success: true, data: [product] }))).length, 1);
  for (const [status, body, pattern] of [
    [401, {}, /session/], [403, {}, /access/], [409, { success: false, message: "Product slug already exists" }, /slug/],
    [500, {}, /request/], [200, { success: true, data: null }, /unexpected/],
  ] as const) await assert.rejects(catalogRequest("/api/admin/products", productListSchema, {}, mock(status, body)), pattern);
  await assert.rejects(catalogRequest("/api/admin/products", productListSchema, {}, mock(400, { success: false, message: "Invalid product data", errors: { fieldErrors: { slug: ["Invalid slug"] } } })), error => error instanceof CatalogApiError && error.fieldErrors.slug[0] === "Invalid slug");
  await assert.rejects(catalogRequest("/api/admin/products", productListSchema, {}, (async () => { throw new Error("offline"); }) as typeof fetch), /connection/);
  let submitted = false;
  await catalogRequest("/api/admin/products", z.object({ id: z.string(), status: z.literal("DRAFT") }), { method: "POST", body: JSON.stringify(draftFormSchema.parse(form)) }, (async (url, init) => {
    assert.equal(url, "/api/admin/products"); assert.equal(init?.credentials, "same-origin");
    const body = JSON.parse(init?.body as string); assert.equal(body.status, "DRAFT"); assert.equal("inventory" in body.variants[0], false);
    submitted = true; return new Response(JSON.stringify({ success: true, data: { id: "p", status: "DRAFT" } }), { status: 201 });
  }) as typeof fetch);
  assert.equal(submitted, true);
});
type Post = (request: Request) => Promise<Response>;
test("actual ADMIN POST validates request and passes nested draft data to real service using only a mock repository", async () => {
  let creates = 0;
  const load = sourceLoader({
    "@/generated/prisma/client": { Prisma: {} },
    "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
    [path.resolve("src/features/products/repositories/product.repository")]: { productRepository: {
      findBySlug: async () => null,
      createWithReferences: async (data: { status: string; variants: { create: Record<string, unknown>[] }; images: { create: unknown[] }; categories: unknown; collections: unknown }) => {
        creates++; assert.equal(data.status, "DRAFT"); assert.equal(data.variants.create[0].inventory, undefined);
        assert.ok(data.categories); assert.ok(data.collections); assert.equal(data.images, undefined);
        return { id: "p", status: data.status };
      },
    } },
  });
  const post = load("src/app/api/admin/products/route.ts").POST as Post;
  const request = (body: unknown) => new Request("http://localhost/api/admin/products", { method: "POST", body: JSON.stringify(body) });
  assert.equal((await post(request({ name: "Invalid" }))).status, 400);
  assert.equal(creates, 0);
  const response = await post(request(draftFormSchema.parse(form)));
  assert.equal(response.status, 201); assert.equal((await response.json()).data.status, "DRAFT"); assert.equal(creates, 1);
});
test("actual ADMIN POST rejects unauthenticated request before reading its body", async () => {
  const load = sourceLoader({ "@/lib/auth/admin-guard": { getAdminSession: async () => null }, "@/features/products/services/product.service": { productService: { createProduct: () => { throw new Error("must not run"); } } } });
  const request = new Request("http://localhost/api/admin/products", { method: "POST" });
  request.json = async () => { throw new Error("must not read"); };
  assert.equal((await (load("src/app/api/admin/products/route.ts").POST as Post)(request)).status, 401);
});
test("actual ADMIN POST reports an existing slug without writing", async () => {
  const load = sourceLoader({
    "@/generated/prisma/client": { Prisma: {} },
    "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
    [path.resolve("src/features/products/repositories/product.repository")]: { productRepository: {
      findBySlug: async () => ({ id: "existing" }), create: () => { throw new Error("must not write"); },
    } },
  });
  const response = await (load("src/app/api/admin/products/route.ts").POST as Post)(new Request("http://localhost/api/admin/products", { method: "POST", body: JSON.stringify(draftFormSchema.parse(form)) }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, "Product slug already exists");
});
