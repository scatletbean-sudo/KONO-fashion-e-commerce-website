import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { sourceLoader } from "@/lib/testing/load-source";
import { createProductSchema } from "../schemas/product.schema";
import { attributeConflict, attributeFormValues, parseAttributeForm, selectableAttributes } from "../admin/attribute-management";

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
const context = { params: Promise.resolve({ id: "existing" }) };
const request = (method: string, data: unknown) => new Request("http://localhost/api/admin/test", { method, body: JSON.stringify(data) });
const resources = [
  ["categories", "category", "Category"], ["collections", "collection", "Collection"],
  ["colors", "color", "Color"], ["sizes", "size", "Size"],
] as const;

test("attribute forms reuse backend schemas, validate HEX/order and keep unsupported status fields out", () => {
  for (const [resource] of resources) {
    const form = { ...attributeFormValues(), name: "New attribute", slug: "new-attribute", hexCode: "#fff" };
    const parsed = parseAttributeForm(resource, form);
    assert.equal(parsed.success, true);
    assert.equal(parseAttributeForm(resource, { ...form, name: " " }).success, false);
    assert.equal(parseAttributeForm(resource, { ...form, slug: "BAD SLUG" }).success, false);
    if (parsed.success && (resource === "colors" || resource === "sizes")) assert.equal("isActive" in parsed.data, false);
  }
  assert.equal(parseAttributeForm("colors", { ...attributeFormValues(), name: "Black", slug: "black", hexCode: "wrong" }).success, false);
  assert.equal(parseAttributeForm("colors", { ...attributeFormValues(), name: "Black", slug: "black", hexCode: "" }).success, true);
  for (const sortOrder of ["", "-1", "1.2", "1e3", "2147483648"]) assert.equal(parseAttributeForm("sizes", { ...attributeFormValues(), name: "M", slug: "m", sortOrder }).success, false);
  const items = [{ id: "a", name: "Black", slug: "black" }];
  assert.equal(attributeConflict(items, " black ", "other")?.field, "name");
  assert.equal(attributeConflict(items, "Different", "black")?.field, "slug");
  assert.equal(attributeConflict(items, "Black", "black", "a"), null);
});
test("Create Product only offers active category/collection IDs and existing Color/Size options", () => {
  const options = [{ id: "active", name: "A", isActive: true }, { id: "inactive", name: "B", isActive: false }, { id: "no-status", name: "C" }];
  assert.deepEqual(selectableAttributes("categories", options).map(item => item.id), ["active"]);
  assert.deepEqual(selectableAttributes("collections", options).map(item => item.id), ["active"]);
  assert.deepEqual(selectableAttributes("colors", options).map(item => item.id), ["active", "no-status"]);
  assert.deepEqual(selectableAttributes("sizes", options).map(item => item.id), ["active", "no-status"]);
});

for (const [resource, singular, label] of resources) {
  function fixture() {
    const writes: { method: string; data: Record<string, unknown> }[] = [];
    let nameConflict = false; let slugConflict = false;
    const existing = { id: "existing", name: "Original", slug: "original", isActive: true, products: [{ productId: "old-product" }], variants: [{ id: "old-variant" }] };
    const repository = {
      findAll: async () => [existing], findById: async () => existing,
      findByName: async (name: string, excludeId?: string) => { assert.ok(name.trim()); if (excludeId) assert.equal(excludeId, "existing"); return nameConflict ? { id: "other" } : null; },
      findBySlug: async () => slugConflict ? { id: "other" } : null,
      create: async (data: Record<string, unknown>) => { writes.push({ method: "create", data }); return { id: "new", ...data }; },
      update: async (id: string, data: Record<string, unknown>) => { assert.equal(id, "existing"); writes.push({ method: "update", data }); return { ...existing, ...data }; },
    };
    const load = sourceLoader({
      "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
      [path.resolve(`src/features/products/${resource}/repositories/${singular}.repository`)]: { [`${singular}Repository`]: repository },
    });
    return { load, writes, conflict: (name: boolean, slug: boolean) => { nameConflict = name; slugConflict = slug; } };
  }
  test(`${label} ADMIN POST/PATCH use real schemas/services; duplicate name/slug fails without writes`, async () => {
    const f = fixture();
    const post = f.load(`src/app/api/admin/${resource}/route.ts`).POST as Handler;
    const patch = f.load(`src/app/api/admin/${resource}/[id]/route.ts`).PATCH as Handler;
    const data = { name: "New", slug: "new", ...(resource === "colors" ? { hexCode: "#abc" } : resource === "sizes" ? { sortOrder: 2 } : { description: "Description", isActive: true }) };
    assert.equal((await post(request("POST", { name: "" }), context)).status, 400);
    assert.equal(f.writes.length, 0);
    assert.equal((await post(request("POST", data), context)).status, 201);
    assert.equal((await patch(request("PATCH", { ...data, name: "Updated" }), context)).status, 200);
    const before = f.writes.length;
    for (const [name, slug] of [[true, false], [false, true]]) {
      f.conflict(name, slug);
      assert.equal((await post(request("POST", data), context)).status, 409);
      assert.equal((await patch(request("PATCH", data), context)).status, 409);
    }
    assert.equal(f.writes.length, before);
    f.conflict(false, false);
    if (resource === "categories" || resource === "collections") {
      const response = await patch(request("PATCH", { isActive: false }), context);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.isActive, false);
      assert.equal(body.data.products[0].productId, "old-product");
      assert.equal(f.writes.at(-1)?.data.products, undefined, "deactivation must not detach products");
    } else {
      assert.equal((await post(request("POST", { ...data, isActive: false }), context)).status, 400);
    }
  });
  test(`${label} deletion locks the row and refuses used attributes; unused deletion remains supported`, async () => {
    let used = true; let deleted = false;
    const operations: string[] = [];
    const tx = {
      $queryRaw: async () => { operations.push("lock"); return []; },
      [singular]: {
        findUnique: async () => { operations.push("check"); return { id: "existing", _count: { products: used ? 1 : 0, variants: used ? 1 : 0, children: 0 } }; },
        delete: async () => { operations.push("delete"); deleted = true; return { id: "existing" }; },
      },
    };
    const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma: { $transaction: async (callback: (client: unknown) => Promise<unknown>) => callback(tx) } } });
    const remove = load("src/features/products/attributes/guarded-delete.ts").deleteUnusedAttribute as (resource: string, id: string) => Promise<unknown>;
    await assert.rejects(remove(singular, "existing"), /is in use/);
    assert.equal(deleted, false); assert.deepEqual(operations, ["lock", "check"]);
    used = false; operations.length = 0;
    await remove(singular, "existing"); assert.equal(deleted, true); assert.deepEqual(operations, ["lock", "check", "delete"]);
  });
}

test("name lookup applies case-insensitive matching and excludes the edited ID in all repositories", async () => {
  for (const [resource, singular] of resources) {
    const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma: { [singular]: { findFirst: async (query: { where: { name: { equals: string; mode: string }; id: { not: string } } }) => {
      assert.equal(query.where.name.equals, "Black"); assert.equal(query.where.name.mode, "insensitive"); assert.equal(query.where.id.not, "self"); return null;
    } } } } });
    const repository = load(`src/features/products/${resource}/repositories/${singular}.repository.ts`)[`${singular}Repository`] as { findByName: (name: string, id: string) => Promise<unknown> };
    await repository.findByName("Black", "self");
  }
});

test("real Product API/repository rejects missing or inactive attribute IDs before insert and validates inside the write transaction", async () => {
  for (const invalid of ["category", "category-inactive", "collection", "collection-inactive", "color", "size", "none"] as const) {
    let creates = 0; let insideTransaction = false; const locks: string[] = [];
    const product = { findUnique: async () => null, create: async () => { assert.equal(insideTransaction, true); creates++; return { id: "new", status: "DRAFT" }; } };
    const db: Record<string, unknown> = { product, $queryRaw: async (query: { sql: string }) => { assert.equal(insideTransaction, true); locks.push(query.sql); return []; } };
    for (const [, singular] of resources) db[singular] = { findMany: async (query: { where: { id: { in: string[] }; isActive?: boolean } }) => {
      assert.equal(insideTransaction, true);
      if (singular === "category" || singular === "collection") assert.equal(query.where.isActive, true);
      else assert.equal("isActive" in query.where, false);
      const records = invalid === singular ? [] : query.where.id.in.map(id => ({ id, isActive: invalid !== `${singular}-inactive` }));
      return records.filter(record => query.where.isActive !== true || record.isActive);
    } };
    db.$transaction = async (callback: (client: unknown) => Promise<unknown>) => { insideTransaction = true; try { return await callback(db); } finally { insideTransaction = false; } };
    const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma: db }, "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) } });
    const data = createProductSchema.parse({ name: "Draft", slug: "draft", basePrice: 100, categoryIds: ["cat"], collectionIds: ["col"], variants: [{ sku: "SKU", colorId: "black", sizeId: "m" }] });
    const response = await (load("src/app/api/admin/products/route.ts").POST as Handler)(request("POST", data), context);
    assert.equal(response.status, invalid === "none" ? 201 : 400);
    assert.equal(creates, invalid === "none" ? 1 : 0);
    assert.ok(locks.every(sql => sql.includes("FOR SHARE")));
    if (invalid !== "none") assert.match((await response.json()).message, /unavailable|inactive/);
  }
});

test("duplicate names are rechecked under a transaction advisory lock before each repository write", async () => {
  for (const [resource, singular] of resources) {
    let conflict = true;
    const operations: string[] = [];
    const tx = { $queryRaw: async (query: { sql: string }) => { assert.match(query.sql, /pg_advisory_xact_lock/); operations.push("lock"); return []; },
      [singular]: { findFirst: async () => { operations.push("check"); return conflict ? { id: "other" } : null; },
        create: async () => { operations.push("create"); return { id: "new" }; }, update: async () => { operations.push("update"); return { id: "self" }; } },
    };
    const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma: { $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback(tx) } } });
    const repository = load(`src/features/products/${resource}/repositories/${singular}.repository.ts`)[`${singular}Repository`] as { create: (data: unknown) => Promise<unknown>; update: (id: string, data: unknown) => Promise<unknown> };
    await assert.rejects(repository.create({ name: "Same", slug: "same" }), /name already exists/);
    assert.deepEqual(operations, ["lock", "check"]);
    operations.length = 0;
    await assert.rejects(repository.update("self", { name: "Same" }), /name already exists/);
    assert.deepEqual(operations, ["lock", "check"]);
    conflict = false; operations.length = 0;
    await repository.create({ name: "New", slug: "new" });
    assert.deepEqual(operations, ["lock", "check", "create"]);
  }
});

test("existing ADMIN DELETE routes return 409 for used attributes without deleting or detaching records", async () => {
  for (const [resource, singular] of resources) {
    let deleted = false;
    const tx = { $queryRaw: async () => [], [singular]: {
      findUnique: async () => ({ id: "existing", _count: { products: 1, variants: 1, children: 1 } }),
      delete: async () => { deleted = true; throw new Error("must not delete"); },
    } };
    const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
      "@/lib/db/prisma": { prisma: { ...tx, $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback(tx) } },
    });
    const response = await (load(`src/app/api/admin/${resource}/[id]/route.ts`).DELETE as Handler)(request("DELETE", {}), context);
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /is in use/);
    assert.equal(deleted, false);
  }
});

test("attribute mutations require ADMIN before parsing the body or invoking services", async () => {
  for (const [resource, singular] of resources) {
    const load = sourceLoader({ "@/lib/auth/admin-guard": { getAdminSession: async () => null },
      [`@/features/products/${resource}/services/${singular}.service`]: { [`${singular}Service`]: new Proxy({}, { get: () => () => { throw new Error("service must not run"); } }) },
    });
    for (const [suffix, method] of [["route.ts", "POST"], ["[id]/route.ts", "PATCH"], ["[id]/route.ts", "DELETE"]]) {
      const req = request(method, {}); req.json = async () => { throw new Error("body must not be read"); };
      assert.equal((await (load(`src/app/api/admin/${resource}/${suffix}`)[method] as Handler)(req, context)).status, 401);
    }
  }
});

test("ADMIN attribute DELETE returns deleted record, maps FK/concurrency errors and keeps missing records safe", async () => {
  for (const [resource, singular] of resources) {
    for (const scenario of ["success", "missing", "P2003", "P2014", "P2025", "P2034", "P2028", "40001", "40P01", "55P03"]) {
      let deleted = 0;
      const record = { id: "existing", name: "Unused", slug: "unused", _count: { products: 0, variants: 0, children: 0 } };
      const tx = { $queryRaw: async () => [], [singular]: {
        findUnique: async () => scenario === "missing" ? null : record,
        delete: async () => {
          if (scenario !== "success") throw Object.assign(new Error("PRIVATE DATABASE DETAILS"), { code: scenario.startsWith("P") ? scenario : "P2010", meta: { code: scenario } });
          deleted++; return record;
        },
      } };
      const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
        "@/lib/db/prisma": { prisma: { ...tx, $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback(tx) } },
      });
      const response = await (load("src/app/api/admin/" + resource + "/[id]/route.ts").DELETE as Handler)(request("DELETE", {}), context);
      assert.equal(response.status, scenario === "success" ? 200 : ["missing", "P2025"].includes(scenario) ? 404 : 409);
      const body = await response.json();
      assert.equal(deleted, scenario === "success" ? 1 : 0);
      assert.equal(JSON.stringify(body).includes("PRIVATE DATABASE DETAILS"), false);
      if (scenario === "success") assert.equal(body.data.id, "existing");
    }
  }
});

test("Category children alone prevent deletion", async () => {
  const tx = { $queryRaw: async () => [], category: { findUnique: async () => ({ _count: { products: 0, children: 1 } }), delete: async () => { throw new Error("must not delete"); } } };
  const load = sourceLoader({ "@/generated/prisma/client": { Prisma }, "@/lib/db/prisma": { prisma: { $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback(tx) } } });
  const remove = load("src/features/products/attributes/guarded-delete.ts").deleteUnusedAttribute as (resource: string, id: string) => Promise<unknown>;
  await assert.rejects(remove("category", "parent"), /child categories/);
});
