import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";
test("Zustand prevents concurrent mutation, trusts server snapshots and preserves lines on failure", async () => {
  let calls = 0;
  let release: (value: Response) => void = () => {};
  const load = sourceLoader({}, { AbortSignal, fetch: async (_url: string, init: RequestInit) => {
    calls++; assert.equal(init.credentials, "same-origin");
    assert.deepEqual(JSON.parse(String(init.body)), { variantId: "v", quantity: 2 });
    return new Promise<Response>(resolve => { release = resolve; });
  } });
  type Store = { items: { quantity: number; price: number }[]; busy: boolean; error: string; setQuantity: (id: string, quantity: number) => Promise<boolean> };
  const store = load("src/features/cart/cart-store.ts").useCartStore as { getState: () => Store };
  const first = store.getState().setQuantity("v", 2);
  assert.equal(await store.getState().setQuantity("v", 2), false);
  assert.equal(calls, 1);
  release(Response.json({ success: true, data: { items: [{ variantId: "v", productId: "p", name: "Cargo", slug: "cargo", color: "Black", size: "M", quantity: 2, price: 520000, maxQuantity: 3 }] } }));
  assert.equal(await first, true); assert.equal(store.getState().items[0].quantity, 2);
  const retry = store.getState().setQuantity("v", 2);
  release(Response.json({ success: false, message: "Stock changed" }, { status: 409 }));
  assert.equal(await retry, false); assert.equal(store.getState().items[0].quantity, 2); assert.equal(store.getState().busy, false); assert.equal(store.getState().error, "Stock changed");
});
