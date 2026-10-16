import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";
import type { TLSSocket } from "node:tls";
import { assertMediaDevelopmentUrl, assertMediaDevelopmentIdentity, mediaDevelopmentTarget } from "../src/features/products/images/media-dev-runtime";

export const testProduct = { name: "KONO CART INTEGRATION TEST", slug: "test-kono-cart-integration-dev2", basePrice: 899000 } as const;
function guard(condition: unknown): asserts condition { if (!condition) throw new Error("Development TEST draft verification failed."); }
export function assertTestDraft(row: Record<string, unknown>) {
  guard(typeof row.id === "string" && row.id.startsWith("test-cart-") && row.name === testProduct.name && row.slug === testProduct.slug && row.basePrice === testProduct.basePrice && row.status === "DRAFT" && row.publishedAt === null);
}
export async function verify(client: Client, readOnly: boolean) {
  const row = (await client.query(`SELECT current_database() AS database,current_schema() AS schema,
    current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
    current_setting('neon.endpoint_id',true) AS endpoint,current_setting('transaction_read_only') AS "readOnly"`)).rows[0];
  guard((client.connection.stream as TLSSocket).authorized === true);
  guard(Object.entries(mediaDevelopmentTarget).every(([key, value]) => row[key] === value));
  guard(row.readOnly === (readOnly ? "on" : "off"));
  if (readOnly) assertMediaDevelopmentIdentity(row);
  return row;
}
const protectedId = "cmuedw86k0000q0ufukh57s7m";
export async function sourceFingerprint(client: Client) {
  const row = (await client.query(`SELECT jsonb_build_object('product',to_jsonb(p),
    'images',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public."ProductImage" i WHERE i."productId"=p.id),
    'variants',(SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public."ProductVariant" v WHERE v."productId"=p.id),
    'inventory',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public."Inventory" i JOIN public."ProductVariant" v ON i."variantId"=v.id WHERE v."productId"=p.id)) AS snapshot
    FROM public."Product" p WHERE p.id=$1`, [protectedId])).rows[0];
  guard(row?.snapshot?.product?.status === "DRAFT");
  return createHash("sha256").update(JSON.stringify(row.snapshot)).digest("hex");
}
export async function ensureTestDraft(client: Client) {
  // Serializes reruns of this narrowly scoped fixture, without updating existing data.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [testProduct.slug]);
  const rows = (await client.query('SELECT id,name,slug,status,"basePrice","publishedAt" FROM public."Product" WHERE slug=$1 OR name=$2 FOR UPDATE', [testProduct.slug, testProduct.name])).rows;
  guard(rows.length <= 1);
  if (rows.length) { assertTestDraft(rows[0]); return { product: rows[0], created: false }; }
  const row = (await client.query(`INSERT INTO public."Product" (id,name,slug,status,"basePrice","updatedAt")
    VALUES ($1,$2,$3,'DRAFT',$4,CURRENT_TIMESTAMP)
    RETURNING id,name,slug,status,"basePrice","publishedAt"`, [`test-cart-${randomUUID()}`, testProduct.name, testProduct.slug, testProduct.basePrice])).rows[0];
  assertTestDraft(row);
  return { product: row, created: true };
}
export async function main() {
  guard(process.argv.length === 3 && ["--check", "--apply"].includes(process.argv[2]));
  const settings = { ...dotenv.parse(fs.readFileSync(".env")), ...process.env };
  guard(settings.NODE_TLS_REJECT_UNAUTHORIZED !== "0");
  const connection = new URL(settings.KONO_MEDIA_DEV_DATABASE_URL ?? "");
  connection.searchParams.set("sslmode", "verify-full");
  assertMediaDevelopmentUrl(connection.toString());
  connection.hostname = connection.hostname.replace("-pooler.", ".");
  connection.searchParams.set("options", "-c search_path=public");
  const response = await fetch("http://127.0.0.1:3001/api/media-dev/runtime", { signal: AbortSignal.timeout(15000) });
  const runtime = await response.json(); guard(response.ok && runtime.success);
  assertMediaDevelopmentIdentity(runtime.identity);
  const client = new Client({ connectionString: connection.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  client.on("error", () => {});
  let committed = false;
  try {
    await client.connect(); await client.query("BEGIN READ ONLY");
    const identity = await verify(client, true);
    const original = await sourceFingerprint(client);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ stage: "read_only_guard_verified", identity }));
    if (process.argv[2] === "--check") return;
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await verify(client, false);
    await client.query('SELECT id FROM public."Product" WHERE id=$1 FOR SHARE', [protectedId]);
    guard(await sourceFingerprint(client) === original);
    const result = await ensureTestDraft(client);
    guard(await sourceFingerprint(client) === original);
    await client.query("COMMIT"); committed = true;
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verify(client, true);
    const row = (await client.query(`SELECT p.id,p.name,p.slug,p.status,p."basePrice",p."publishedAt",
      (SELECT count(*)::int FROM public."ProductImage" i WHERE i."productId"=p.id) AS images,
      (SELECT count(*)::int FROM public."ProductVariant" v WHERE v."productId"=p.id) AS variants
      FROM public."Product" p WHERE p.id=$1`, [result.product.id])).rows[0];
    assertTestDraft(row);
    guard((!result.created || (row.images === 0 && row.variants === 0)) && await sourceFingerprint(client) === original);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ result: result.created ? "draft_created_read_only_verified" : "existing_draft_read_only_verified", product: row, protectedProductUnchanged: true, editUrl: `http://127.0.0.1:3001/admin/products/${row.id}/edit#media-manager` }));
  } catch {
    console.error(committed ? "Draft transaction committed, but follow-up verification failed. Inspect Development read-only before retrying." : "Stopped or failed. Transaction rollback requested; no sensitive details displayed. If connection failed around COMMIT, inspect Development before retrying.");
    throw new Error("Development TEST draft task stopped.");
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Development TEST draft task failed; raw error details suppressed."); process.exitCode = 1; });
}
