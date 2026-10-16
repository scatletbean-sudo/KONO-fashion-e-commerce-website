import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { TLSSocket } from "node:tls";
import dotenv from "dotenv";
import { Client } from "pg";
import { assertMediaDevelopmentIdentity } from "../src/features/products/images/media-dev-runtime";
import { assertDistinctProduction, assertOnlyApprovedPending, assertReviewedSqlTlsGuard, checksumMatches, checkoutMigration, guard, reviewedChecksum, sha256 } from "./checkout-phase1-deploy-guard";

const migrationRoot = "prisma/migrations";
const shipping = ["recipientName", "recipientPhone", "provinceCode", "provinceName", "wardCode", "wardName", "addressLine", "countryCode", "shippingMethod"];
const tables = ["Order", "OrderItem", "Inventory", "Product", "ProductVariant", "Payment", "Shipment", "Cart", "CartItem"] as const;
const newTables = ["CheckoutAttempt", "InventoryReservation"];
const checks = ["Inventory_values_check", "Order_money_check", "OrderItem_values_check", "Order_shipping_snapshot_check", "CheckoutAttempt_hashes_check", "CheckoutAttempt_state_check", "InventoryReservation_quantity_check", "InventoryReservation_state_check"];
const foreignKeys = ["CheckoutAttempt_orderId_fkey", "InventoryReservation_orderItemId_fkey", "InventoryReservation_inventoryId_fkey"];
const indexColumns: Record<string, string[]> = {
  CheckoutAttempt_orderId_key: ["orderId"], CheckoutAttempt_status_expiresAt_idx: ["status", "expiresAt"], CheckoutAttempt_ownerHash_keyHash_key: ["ownerHash", "keyHash"],
  InventoryReservation_orderItemId_key: ["orderItemId"], InventoryReservation_inventoryId_status_idx: ["inventoryId", "status"], InventoryReservation_status_expiresAt_idx: ["status", "expiresAt"],
};
type Row = Record<string, unknown>;

async function snapshot(client: Client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const identity = (await client.query(`SELECT current_database() AS database,current_schema() AS schema,
      current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
      current_setting('neon.endpoint_id',true) AS endpoint,current_setting('transaction_read_only') AS "readOnly"`)).rows[0];
    guard((client.connection.stream as TLSSocket).authorized === true, "TLS verification failed");
    assertMediaDevelopmentIdentity(identity);
    const serverSsl = (await client.query("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()")).rows[0]?.ssl;
    const observed = (await client.query("SELECT clock_timestamp() AS at,pg_current_wal_lsn()::text AS lsn")).rows[0];
    const history: Row[] = (await client.query('SELECT migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count FROM public._prisma_migrations ORDER BY migration_name')).rows;
    guard(history.every(row => row.finished_at && !row.rolled_back_at), "Unfinished or rolled-back history requires review");
    for (const row of history) guard(checksumMatches(fs.readFileSync(path.join(migrationRoot, String(row.migration_name), "migration.sql"), "utf8"), String(row.checksum)), "Historical checksum mismatch");
    const local = fs.readdirSync(migrationRoot, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name).sort();
    const pending = local.filter(name => !history.some(row => row.migration_name === name));
    const data: Record<string, Row> = {};
    for (const table of tables) {
      // Only aggregate digests leave PostgreSQL. No customer fields/credentials are exported.
      const omitted = table === "Order" ? shipping : table === "OrderItem" ? ["colorName", "sizeName"] : [];
      data[table] = (await client.query(`SELECT count(*)::int AS count,
        md5(coalesce(jsonb_agg(to_jsonb(t) - $1::text[] ORDER BY id)::text,'[]')) AS digest
        FROM public."${table}" t`, [omitted])).rows[0];
    }
    const inventory = (await client.query('SELECT coalesce(sum(quantity),0)::text AS quantity,coalesce(sum(reserved),0)::text AS reserved FROM public."Inventory"')).rows[0];
    const invalid = (await client.query(`SELECT
      (SELECT count(*)::int FROM public."Inventory" WHERE quantity<0 OR reserved<0 OR reserved>quantity OR "lowStockAt"<0) AS inventory,
      (SELECT count(*)::int FROM public."OrderItem" WHERE quantity<=0 OR "unitPrice"<0 OR "totalPrice"<0 OR "totalPrice"::bigint<>quantity::bigint*"unitPrice"::bigint) AS items,
      (SELECT count(*)::int FROM public."Order" WHERE subtotal<0 OR "discountAmount"<0 OR "shippingAmount"<0 OR "taxAmount"<0 OR "totalAmount"<0) AS orders`)).rows[0];
    guard(Object.values(invalid).every(value => value === 0), "Data violates reviewed checks");
    const inspected = ["Order", "OrderItem", "Inventory", ...newTables];
    const columns: Row[] = (await client.query(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [inspected])).rows;
    const constraints: Row[] = (await client.query(`SELECT c.conname,c.contype,c.convalidated,c.confdeltype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.connamespace='public'::regnamespace AND t.relname=ANY($1::text[]) ORDER BY c.conname`, [inspected])).rows;
    const indexes: Row[] = (await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY indexname", [inspected])).rows;
    const enums: Row[] = (await client.query(`SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace AND t.typname=ANY($1::text[]) ORDER BY t.typname,e.enumsortorder`, [["CheckoutAttemptStatus", "InventoryReservationStatus"]])).rows;
    const foundationCounts: Record<string, number> = {};
    for (const table of newTables) if (columns.some(row => row.table_name === table)) foundationCounts[table] = (await client.query(`SELECT count(*)::int AS count FROM public."${table}"`)).rows[0].count;
    return { identity, tlsAuthorized: true, serverSsl, observed, history, pending, data, inventory, invalid, columns, constraints, indexes, enums, foundationCounts };
  } finally { await client.query("ROLLBACK"); }
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
function verifyAfter(before: Snapshot, after: Snapshot) {
  guard(after.pending.length === 0 && after.history.length === before.history.length + 1, "Unexpected post-deploy migration history");
  const row = after.history.find(row => row.migration_name === checkoutMigration);
  guard(row?.finished_at && row.checksum === reviewedChecksum && !row.rolled_back_at && row.applied_steps_count === 1, "Reviewed migration did not finish correctly");
  for (const old of before.history) guard(JSON.stringify(after.history.find(row => row.migration_name === old.migration_name)) === JSON.stringify(old), "Previous migration history changed");
  guard(JSON.stringify(before.data) === JSON.stringify(after.data) && JSON.stringify(before.inventory) === JSON.stringify(after.inventory), "Business rows or inventory changed");
  guard(newTables.every(table => after.foundationCounts[table] === 0), "Unexpected foundation data exists");
  for (const [table, names] of [["Order", [...shipping, "customerEmail"]], ["OrderItem", ["colorName", "sizeName"]]] as const) {
    for (const name of names) guard(after.columns.some(row => row.table_name === table && row.column_name === name && row.is_nullable === "YES" && row.data_type === "text"), "Snapshot/email column missing or incorrect");
  }
  for (const name of checks) guard(after.constraints.some(row => row.conname === name && row.contype === "c" && row.convalidated === true), "CHECK missing or unvalidated");
  for (const name of foreignKeys) guard(after.constraints.some(row => row.conname === name && row.contype === "f" && row.convalidated === true && row.confdeltype === "r"), "Foreign key incorrect");
  for (const [name, fields] of Object.entries(indexColumns)) guard(after.indexes.some(row => row.indexname === name && fields.every(field => String(row.indexdef).includes(field)) && (name.endsWith("_key") ? String(row.indexdef).includes("UNIQUE INDEX") : true)), "Index incorrect");
  for (const [name, labels] of [["CheckoutAttemptStatus", ["PENDING", "COMPLETED", "FAILED", "EXPIRED"]], ["InventoryReservationStatus", ["HELD", "RELEASED", "CONSUMED"]]] as const)
    guard(JSON.stringify(after.enums.filter(row => row.typname === name).map(row => row.enumlabel)) === JSON.stringify(labels), "Enum mismatch");
}

export async function main() {
  guard(process.argv.length === 3 && ["--check", "--apply"].includes(process.argv[2]), "Use --check or --apply");
  const settings = { ...dotenv.parse(fs.readFileSync(".env")), ...process.env };
  const envHash = sha256(fs.readFileSync(".env"));
  const sqlPath = path.join(migrationRoot, checkoutMigration, "migration.sql");
  guard(sha256(fs.readFileSync(sqlPath)) === reviewedChecksum, "Reviewed SQL bytes changed");
  const readonlyUrl = assertDistinctProduction(settings);
  const client = new Client({ connectionString: readonlyUrl, enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  client.on("error", () => {});
  const folder = path.resolve(".kono-backups", `checkout-phase1-deploy-${randomUUID()}`);
  let deployStarted = false;
  try {
    await client.connect();
    const before = await snapshot(client);
    assertReviewedSqlTlsGuard(before.serverSsl);
    assertOnlyApprovedPending(before.pending);
    guard(Object.keys(before.foundationCounts).length === 0 && before.enums.length === 0, "Untracked foundation schema already exists");
    guard(!before.columns.some(row => shipping.includes(String(row.column_name)) && row.table_name === "Order" || ["colorName", "sizeName"].includes(String(row.column_name)) && row.table_name === "OrderItem"), "Untracked snapshot columns already exist");
    fs.mkdirSync(path.join(folder, "migrations"), { recursive: true });
    const manifest: Record<string, string> = {};
    for (const name of [...before.history.map(row => String(row.migration_name)), checkoutMigration].sort()) {
      const content = fs.readFileSync(path.join(migrationRoot, name, "migration.sql"));
      manifest[name] = sha256(content);
      fs.mkdirSync(path.join(folder, "migrations", name));
      fs.writeFileSync(path.join(folder, "migrations", name, "migration.sql"), content);
    }
    fs.copyFileSync(path.join(migrationRoot, "migration_lock.toml"), path.join(folder, "migrations", "migration_lock.toml"));
    fs.writeFileSync(path.join(folder, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(folder, "before.json"), JSON.stringify(before, null, 2));
    const childEnv = { ...process.env, KONO_MEDIA_DEV_DATABASE_URL: readonlyUrl, KONO_CHECKOUT_PHASE1_REVIEWED_CHECKSUM: reviewedChecksum, KONO_CHECKOUT_PHASE1_MIGRATIONS_PATH: path.join(folder, "migrations") };
    delete (childEnv as Record<string, string | undefined>).DATABASE_URL;
    function prisma(args: string[]) {
      const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args, "--config", "prisma.checkout-deploy.config.ts"], { env: childEnv, encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
      guard(result.status === 0 && !result.error, `Prisma ${args[1]} failed; raw details suppressed`);
      return result.stdout;
    }
    const normalize = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
    const liveDiff = prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"]);
    const reviewedBase = fs.readFileSync(sqlPath, "utf8").split("-- CreateEnum")[1];
    guard(reviewedBase !== undefined, "Cannot locate reviewed DDL");
    const migrationDdl = "CREATE TYPE" + fs.readFileSync(sqlPath, "utf8").split("CREATE TYPE").slice(1).join("CREATE TYPE").split("-- SQL-only CHECK constraints")[0];
    guard(normalize(liveDiff) === normalize(migrationDdl), "Live schema drift differs from reviewed DDL");
    fs.writeFileSync(path.join(folder, "live-diff.sql"), liveDiff);
    console.log(JSON.stringify({ stage: "preflight_passed", identity: before.identity, tlsAuthorized: true, productionEndpointDifferent: true, pending: before.pending, checksum: reviewedChecksum, counts: Object.fromEntries(Object.entries(before.data).map(([table, row]) => [table, row.count])), inventory: before.inventory, reportFolder: folder }));
    if (process.argv[2] === "--check") return;
    // Re-read identity/history/data immediately before the isolated deploy.
    const fresh = await snapshot(client);
    assertReviewedSqlTlsGuard(fresh.serverSsl);
    assertOnlyApprovedPending(fresh.pending);
    guard(JSON.stringify(before.data) === JSON.stringify(fresh.data) && JSON.stringify(before.history) === JSON.stringify(fresh.history), "Preflight baseline changed");
    guard(sha256(fs.readFileSync(sqlPath)) === reviewedChecksum && sha256(fs.readFileSync(".env")) === envHash, "Reviewed SQL/environment file changed");
    deployStarted = true;
    const output = prisma(["migrate", "deploy"]);
    // Never print raw CLI output (it may include a datasource hostname).
    fs.writeFileSync(path.join(folder, "deploy-result.json"), JSON.stringify({ commandSucceeded: true, outputDigest: sha256(output) }));
    const after = await snapshot(client);
    fs.writeFileSync(path.join(folder, "after.json"), JSON.stringify(after, null, 2));
    verifyAfter(before, after);
    const newSnapshots = (await client.query(`SELECT
      (SELECT count(*)::int FROM public."Order" WHERE num_nonnulls(${shipping.map(name => `"${name}"`).join(",")})>0) AS orders,
      (SELECT count(*)::int FROM public."OrderItem" WHERE "colorName" IS NOT NULL OR "sizeName" IS NOT NULL) AS items`)).rows[0];
    guard(newSnapshots.orders === 0 && newSnapshots.items === 0, "Legacy snapshots were unexpectedly populated");
    guard(sha256(fs.readFileSync(".env")) === envHash && sha256(fs.readFileSync(sqlPath)) === reviewedChecksum, "Protected files changed");
    const result = { stage: "migration_applied_read_only_verified", identity: after.identity, productionEndpointDifferent: true, migration: after.history.find(row => row.migration_name === checkoutMigration), beforeCounts: Object.fromEntries(Object.entries(before.data).map(([name, row]) => [name, row.count])), afterCounts: Object.fromEntries(Object.entries(after.data).map(([name, row]) => [name, row.count])), beforeInventory: before.inventory, afterInventory: after.inventory, businessDigestsUnchanged: true, foundationCounts: after.foundationCounts, legacySnapshotsUnchanged: true, schemaChecksPassed: true, reportFolder: folder };
    fs.writeFileSync(path.join(folder, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ stopped: true, deployStarted, reason: error instanceof Error && /credentials|postgres/i.test(error.message) ? "Suppressed database/configuration error" : error instanceof Error ? error.message : "Unknown failure", recovery: deployStarted ? "Inspect Development READ ONLY before any retry; COMMIT may have succeeded." : "No deployment was attempted." }));
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("STOP: deployment setup failed; no raw configuration displayed."); process.exitCode = 1; });
