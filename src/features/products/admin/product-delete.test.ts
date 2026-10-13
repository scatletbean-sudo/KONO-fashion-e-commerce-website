import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";

type Context = { params: Promise<{ id: string }> };
type Handler = (request: Request, context: Context) => Promise<Response>;
const routes = ["src/app/api/products/[id]/route.ts", "src/app/api/admin/products/[id]/route.ts"];

for (const route of routes) {
  for (const admin of [false, true]) {
    test(`${route} DELETE returns ${admin ? 409 : 401} without service, repository, body or params access`, async () => {
      let guards = 0;
      let businessCalls = 0;
      const forbidden = () => { businessCalls++; throw new Error("Deletion or implicit archive must not run"); };
      const blocked = new Proxy({}, { get: () => forbidden });
      const load = sourceLoader({
        "@/lib/auth/admin-guard": { getAdminSession: async () => { guards++; return admin ? { user: { role: "ADMIN" } } : null; } },
        "@/features/products/services/product.service": { productService: blocked },
        "@/features/products/repositories/product.repository": { productRepository: blocked },
        "@/lib/db/prisma": { prisma: blocked },
      });
      const request = new Request("http://localhost/api/products/missing", { method: "DELETE" });
      request.json = async () => { throw new Error("Body must not be read"); };
      const context = Object.defineProperty({}, "params", { get: () => { throw new Error("Params must not be read"); } }) as Context;
      const response = await (load(route).DELETE as Handler)(request, context);
      assert.equal(response.status, admin ? 409 : 401);
      const body = await response.json();
      assert.equal(body.success, false);
      if (admin) { assert.match(body.message, /Permanent product deletion is not supported/); assert.match(body.message, /PATCH/); }
      else assert.equal(body.message, "Unauthorized");
      assert.equal(guards, 1);
      assert.equal(businessCalls, 0);
    });
  }
  test(`${route} DELETE fails closed when session verification fails`, async () => {
    const load = sourceLoader({
      "@/lib/auth/admin-guard": { getAdminSession: async () => { throw new Error("PRIVATE SESSION DETAILS"); } },
      "@/features/products/services/product.service": { productService: { deleteProduct: () => { throw new Error("Must not delete"); } } },
    });
    const response = await (load(route).DELETE as Handler)(new Request("http://localhost/api/products/p", { method: "DELETE" }), { params: Promise.resolve({ id: "p" }) });
    assert.equal(response.status, 500);
    assert.equal(JSON.stringify(await response.json()).includes("PRIVATE SESSION DETAILS"), false);
  });
  test(`${route} GET/PATCH still use their original services without implicit status changes`, async () => {
    const calls: string[] = [];
    const product = { id: "p", name: "Old name", status: "ACTIVE", basePrice: 100, images: [], variants: [], categories: [], collections: [] };
    const load = sourceLoader({
      "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
      "@/features/products/services/product.service": { productService: {
        getProductById: async (id: string) => { assert.equal(id, "p"); calls.push("GET"); return product; },
        updateProduct: async (data: Record<string, unknown>) => { assert.equal(data.id, "p"); assert.equal(data.name, "New name"); assert.equal(data.status, undefined); calls.push("PATCH"); return { ...product, name: data.name }; },
        deleteProduct: () => { throw new Error("Must not delete"); },
      } },
    });
    const context = { params: Promise.resolve({ id: "p" }) };
    const handlers = load(route);
    assert.equal((await (handlers.GET as Handler)(new Request("http://localhost/api/products/p"), context)).status, 200);
    const response = await (handlers.PATCH as Handler)(new Request("http://localhost/api/products/p", { method: "PATCH", body: JSON.stringify({ name: "New name" }) }), context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "ACTIVE");
    assert.deepEqual(calls, ["GET", "PATCH"]);
  });
}
