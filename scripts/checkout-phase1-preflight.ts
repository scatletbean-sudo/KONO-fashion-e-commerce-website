import fs from "node:fs";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";
import type { TLSSocket } from "node:tls";
import { assertMediaDevelopmentIdentity, assertMediaDevelopmentUrl } from "../src/features/products/images/media-dev-runtime";

export function checkoutDevelopmentConnection(settings: Record<string, string | undefined>) {
  if (settings.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Unsafe TLS configuration");
  // Deliberately no DATABASE_URL fallback, even if the Development setting is missing.
  const url = new URL(settings.KONO_MEDIA_DEV_DATABASE_URL ?? "");
  url.searchParams.set("sslmode", "verify-full");
  assertMediaDevelopmentUrl(url.toString());
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.set("options", "-c default_transaction_read_only=on -c search_path=public");
  return url.toString();
}

export async function preflight() {
  if (process.argv.length !== 3 || process.argv[2] !== "--check-readonly") throw new Error("Only --check-readonly is supported");
  const settings = { ...dotenv.parse(fs.readFileSync(".env")), ...process.env };
  const client = new Client({ connectionString: checkoutDevelopmentConnection(settings), enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = (await client.query(`SELECT current_database() AS database,current_schema() AS schema,
      current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
      current_setting('neon.endpoint_id',true) AS endpoint,current_setting('transaction_read_only') AS "readOnly"`)).rows[0];
    if ((client.connection.stream as TLSSocket).authorized !== true) throw new Error("TLS verification failed");
    assertMediaDevelopmentIdentity(identity);
    // No application-table reads until the server identity and TLS have passed.
    const history = (await client.query('SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name')).rows;
    if (history.some(row => !row.finished && !row.rolled_back)) throw new Error("Unfinished migration exists");
    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM public."Order") AS orders,
      (SELECT count(*)::int FROM public."OrderItem") AS items,
      (SELECT count(*)::int FROM public."Inventory") AS inventory,
      (SELECT count(*)::int FROM public."Payment") AS payments`)).rows[0];
    const invalid = (await client.query(`SELECT
      (SELECT count(*)::int FROM public."Inventory" WHERE quantity<0 OR reserved<0 OR reserved>quantity OR "lowStockAt"<0) AS inventory,
      (SELECT count(*)::int FROM public."OrderItem" WHERE quantity<=0 OR "unitPrice"<0 OR "totalPrice"<0 OR "totalPrice"::bigint<>quantity::bigint*"unitPrice"::bigint) AS items,
      (SELECT count(*)::int FROM public."Order" WHERE subtotal<0 OR "discountAmount"<0 OR "shippingAmount"<0 OR "taxAmount"<0 OR "totalAmount"<0) AS orders`)).rows[0];
    if (Object.values(invalid).some(value => value !== 0)) throw new Error("Existing values violate proposed constraints");
    const columns = (await client.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [["Order", "OrderItem", "Inventory", "CheckoutAttempt", "InventoryReservation"]])).rows;
    const constraints = (await client.query(`SELECT conrelid::regclass::text AS table_name,conname,convalidated,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid IN (
      SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[])) ORDER BY conname`, [["Order", "OrderItem", "Inventory", "CheckoutAttempt", "InventoryReservation"]])).rows;
    await client.query("ROLLBACK");
    return { checkedAt: new Date().toISOString(), identity, tlsAuthorized: true, counts, invalid, history, columns, constraints };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  preflight().then(report => console.log(JSON.stringify(report))).catch(() => {
    console.error("STOP: Development READ ONLY preflight failed. No apply is supported; raw details suppressed.");
    process.exitCode = 1;
  });
}
