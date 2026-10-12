import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
const product = { id: "p", name: "Shirt", slug: "shirt", status: "ACTIVE", basePrice: 100,
  images: [{ id: "image", url: "/shirt.jpg", sortOrder: 0, isPrimary: true }],
  variants: [{ id: "v", productId: "p", sku: "SKU", isActive: true, priceOverride: 120, costPrice: 50,
    color: { id: "black", name: "Black", hexCode: "#000000" }, size: { id: "m", name: "M", sortOrder: 1 },
    inventory: { quantity: 5, reserved: 1, lowStockAt: 2 } }] };

for (const resource of ["categories", "collections"] as const) {
  test(`${resource} uses real repository/service and returns complete public product cards regardless of cookie`, async () => {
    const group = { id: "group", name: "Featured", slug: "featured", isActive: true,
      products: [{ product }, { product: { ...product, id: "draft", status: "DRAFT" } }] };
    let queries = 0;
    const find = async (query: { include: { products: { include: { product: { include: Record<string, unknown> } } } } }) => {
      queries++;
      assert.ok(query.include.products.include.product.include.images);
      assert.ok(query.include.products.include.product.include.variants);
      return group;
    };
    for (const admin of [false, true]) {
      const load = sourceLoader({
        "@/lib/db/prisma": { prisma: { [resource === "categories" ? "category" : "collection"]: {
          findMany: async (query: Parameters<typeof find>[0]) => [await find(query)], findUnique: find,
        } } },
        "@/lib/auth/admin-guard": { getAdminSession: async () => admin ? { user: { role: "ADMIN" } } : null },
      });
      for (const suffix of ["route.ts", "[id]/route.ts"]) {
        const publicHandler = load(`src/app/api/${resource}/${suffix}`).GET as Handler;
        const response = await publicHandler(new Request("http://localhost/api/test"), { params: Promise.resolve({ id: "group" }) });
        assert.equal(response.status, 200);
        const payload = await response.json();
        const visible = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        assert.equal(visible.products.length, 1);
        const card = visible.products[0].product;
        assert.equal(card.images[0].url, "/shirt.jpg");
        assert.equal(card.basePrice, 100);
        assert.equal(card.variants[0].priceOverride, 120);
        assert.equal(card.variants[0].color.hexCode, "#000000");
        assert.equal(card.variants[0].size.name, "M");
        assert.equal(card.variants[0].inStock, true);
        assert.equal(JSON.stringify(payload).includes("costPrice"), false);
        assert.equal(JSON.stringify(payload).includes("reserved"), false);

        const adminHandler = load(`src/app/api/admin/${resource}/${suffix}`).GET as Handler;
        const adminResponse = await adminHandler(new Request("http://localhost/api/test"), { params: Promise.resolve({ id: "group" }) });
        assert.equal(adminResponse.status, admin ? 200 : 401);
        if (admin) assert.equal(JSON.stringify(await adminResponse.json()).includes("costPrice"), true);
      }
    }
    assert.equal(queries, 6);
  });
}
