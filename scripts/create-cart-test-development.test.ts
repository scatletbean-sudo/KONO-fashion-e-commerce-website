import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "pg";
import { assertTestDraft, ensureTestDraft, testProduct } from "./create-cart-test-development";

test("TEST draft creation is narrow and reruns perform no updates or duplicate inserts", async () => {
  const rows: Record<string, unknown>[] = [];
  const statements: string[] = [];
  const client = { query: async (sql: string, params: unknown[]) => {
    statements.push(sql);
    assert.equal(/\b(UPDATE public|DELETE|ACTIVE'|ProductImage|ProductVariant|Inventory)\b/.test(sql), false);
    if (sql.startsWith("SELECT id,name")) return { rows };
    if (sql.startsWith("INSERT")) {
      assert.deepEqual(params.slice(1), [testProduct.name, testProduct.slug, 899000]);
      assert.ok(String(params[0]).startsWith("test-cart-"));
      const row = { id: params[0], ...testProduct, status: "DRAFT", publishedAt: null }; rows.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  } } as unknown as Client;
  const first = await ensureTestDraft(client);
  const second = await ensureTestDraft(client);
  assert.equal(first.created, true); assert.equal(second.created, false);
  assert.equal(first.product.id, second.product.id);
  assert.equal(statements.filter(sql => sql.startsWith("INSERT")).length, 1);
});
test("existing mismatched, published or non-test records are rejected without writes", async () => {
  const valid = { id: "test-cart-synthetic", ...testProduct, status: "DRAFT", publishedAt: null };
  assert.doesNotThrow(() => assertTestDraft(valid));
  for (const patch of [{ status: "ACTIVE" }, { publishedAt: new Date() }, { basePrice: 1 }, { id: "real-product" }, { slug: "real-slug" }]) {
    let writes = 0;
    const client = { query: async (sql: string) => { if (sql.startsWith("INSERT")) writes++; return { rows: sql.startsWith("SELECT id,name") ? [{ ...valid, ...patch }] : [] }; } } as unknown as Client;
    await assert.rejects(ensureTestDraft(client)); assert.equal(writes, 0);
  }
});
