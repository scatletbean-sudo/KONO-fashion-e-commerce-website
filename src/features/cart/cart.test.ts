import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";
import { cartInput, stockLimit } from "./cart-contract";

type Variant = { id: string; productId: string; isActive: boolean; priceOverride: number | null; inventory: { quantity: number; reserved: number; lowStockAt?: number } | null; color: { name: string }; size: { name: string }; product: { id: string; name: string; slug: string; status: string; basePrice: number } };
function fixture(patch: Partial<Variant> = {}) {
  const variant: Variant = { id: "v", productId: "p", isActive: true, priceOverride: 520000, inventory: { quantity: 5, reserved: 2 }, color: { name: "Black" }, size: { name: "M" }, product: { id: "p", name: "Cargo", slug: "cargo", status: "ACTIVE", basePrice: 450000 }, ...patch };
  const items: { cartId: string; variantId: string; productId: string; quantity: number }[] = [];
  const calls: string[] = [];
  const db = {
    productVariant: { findFirst: async () => { calls.push("variant"); return variant; } },
    cart: {
      upsert: async () => { calls.push("cart"); return { id: "owned-cart" }; },
      findUnique: async ({ where }: { where: { sessionId: string } }) => { calls.push(`owner:${where.sessionId}`); return { items: items.filter(item => item.cartId === where.sessionId || (where.sessionId === "owner" && item.cartId === "owned-cart")).map(item => ({ ...item, variant })) }; },
    },
    cartItem: {
      findUnique: async () => items.find(item => item.cartId === "owned-cart"),
      count: async () => items.length,
      upsert: async ({ create, update }: { create: typeof items[number]; update: { quantity: number } }) => { calls.push("write"); const existing = items.find(item => item.cartId === create.cartId && item.variantId === create.variantId); if (existing) existing.quantity = update.quantity; else items.push(create); },
      deleteMany: async ({ where }: { where: { cartId: string; variantId: string } }) => { const index = items.findIndex(item => item.cartId === where.cartId && item.variantId === where.variantId); if (index >= 0) items.splice(index, 1); },
    },
    $queryRaw: async (strings: TemplateStringsArray) => { calls.push(strings.join("?")); return []; },
  };
  const load = sourceLoader({ "@/lib/db/prisma": { prisma: { ...db, $transaction: async (action: (tx: typeof db) => Promise<unknown>) => { const before = structuredClone(items); try { return await action(db); } catch (error) { items.splice(0, items.length, ...before); throw error; } } } } });
  const service = load("src/features/cart/cart.service.ts").cartService as {
    read: (owner: string | null) => Promise<{ items: { quantity: number; price: number }[] }>;
    availability: (id: string, owner: string | null) => Promise<{ price: number; maxQuantity: number; lowStock: boolean }>;
    setQuantity: (owner: string, id: string, quantity: number) => Promise<{ items: { quantity: number; price: number }[] }>;
  };
  return { service, variant, items, calls };
}
test("cart schema rejects client prices/owner IDs, fractional and excessive quantity", () => {
  for (const input of [{ variantId: "v", quantity: 1, price: 1 }, { variantId: "v", quantity: 1, sessionId: "other" }, { variantId: "v", quantity: 1.5 }, { variantId: "v", quantity: 100 }]) assert.equal(cartInput.safeParse(input).success, false);
  assert.equal(stockLimit({ quantity: 5, reserved: 2 }), 3);
  assert.equal(stockLimit({ quantity: 200, reserved: 0 }), 99);
  for (const inventory of [null, { quantity: 1, reserved: 2 }, { quantity: -1, reserved: 0 }, { quantity: 1.5, reserved: 0 }]) assert.equal(stockLimit(inventory), 0);
});
test("cart enforces server price, net inventory and idempotent absolute quantity under row locks", async () => {
  const { service, items, calls } = fixture();
  const first = await service.setQuantity("owner", "v", 2);
  assert.equal(first.items[0].price, 520000);
  await service.setQuantity("owner", "v", 2);
  assert.equal(items.length, 1); assert.equal(items[0].quantity, 2);
  assert.ok(calls.indexOf('SELECT id FROM "Cart" WHERE id = ? FOR UPDATE') < calls.indexOf("write"));
  assert.ok(calls.indexOf('SELECT id FROM "Inventory" WHERE "variantId" = ? FOR SHARE') < calls.indexOf("write"));
  await assert.rejects(service.setQuantity("owner", "v", 4), /tồn kho/);
  assert.equal(items[0].quantity, 2);
});
test("cart and availability reject DRAFT/ARCHIVED, disabled variants and invalid price without writes", async () => {
  for (const patch of [{ product: { id: "p", name: "Hidden", slug: "hidden", status: "DRAFT", basePrice: 1 } }, { product: { id: "p", name: "Hidden", slug: "hidden", status: "ARCHIVED", basePrice: 1 } }, { isActive: false }, { priceOverride: 0 }, { priceOverride: -1 }]) {
    const { service, calls } = fixture(patch);
    await assert.rejects(service.availability("v", null));
    await assert.rejects(service.setQuantity("owner", "v", 1));
    assert.equal(calls.includes("write"), false);
  }
});
test("cart reads and availability are read-only; owner isolation and hidden item projection", async () => {
  const f = fixture();
  assert.equal((await f.service.read(null)).items.length, 0);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(await f.service.availability("v", null))), { variantId: "v", price: 520000, maxQuantity: 3, currentQuantity: 0, inStock: true, lowStock: false });
  await f.service.setQuantity("owner", "v", 1);
  assert.equal((await f.service.read("other-owner")).items.length, 0);
  f.variant.product.status = "DRAFT";
  assert.equal((await f.service.read("owner")).items.length, 0);
});
test("removing a line scopes deletion to its owning cart without exposing hidden variant", async () => {
  const f = fixture();
  await f.service.setQuantity("owner", "v", 1);
  f.items.push({ cartId: "another-cart", variantId: "v", productId: "p", quantity: 2 });
  f.variant.product.status = "DRAFT";
  await f.service.setQuantity("owner", "v", 0);
  assert.deepEqual(f.items.map(item => item.cartId), ["another-cart"]);
});
test("cart HTTP requires same origin and never accepts owner/price fields", async () => {
  let writes = 0;
  const load = sourceLoader({ "@/features/cart/cart.service": { cartService: { setQuantity: async () => { writes++; return { items: [] }; }, read: async () => ({ items: [] }) } }, "next/headers": { cookies: async () => ({ get: () => undefined }) } }, { process: { env: { NODE_ENV: "production" } } });
  const route = load("src/app/api/cart/route.ts") as { PUT: (req: Request) => Promise<Response>; GET: () => Promise<Response> };
  assert.equal((await route.GET()).status, 200);
  const put = (origin: string | null, body: unknown) => route.PUT(new Request("https://kono.test/api/cart", { method: "PUT", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) }));
  for (const origin of [null, "https://evil.test"]) assert.equal((await put(origin, { variantId: "v", quantity: 1 })).status, 403);
  assert.equal((await put("https://kono.test", { variantId: "v", quantity: 1, price: 1 })).status, 400);
  assert.equal(writes, 0);
  const response = await put("https://kono.test", { variantId: "v", quantity: 1 });
  assert.equal(response.status, 200); assert.equal(writes, 1);
  const cookie = response.headers.get("set-cookie") ?? "";
  for (const value of ["HttpOnly", "Secure", "SameSite=lax"]) assert.ok(cookie.includes(value));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("low stock uses the configured threshold and net stock, never the capped cart limit", async () => {
  for (const [quantity, reserved, lowStockAt, expected] of [[5, 3, 2, true], [5, 0, 2, false], [2, 0, 0, false], [0, 0, 5, false], [200, 0, 100, false]] as const) {
    const f = fixture({ inventory: { quantity, reserved, lowStockAt } });
    assert.equal((await f.service.availability("v", null)).lowStock, expected);
    assert.equal(f.calls.includes("write"), false);
  }
});
