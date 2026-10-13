// Scoped deployment. Default mode is read-only preflight; --apply performs only
// the reviewed migration after target/history/drift checks and an encrypted backup.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { Client } from "pg";

const migration = "20261013000000_product_image_media";
const reviewedHash = "e5bc796f705d7b09c02bda70bc23d39cb71669b47739a8e98a1e3fc95d70a356";
const expected = { project: "hidden-forest-64993760", branch: "br-dry-pine-b3l81xxy", endpoint: "ep-icy-butterfly-b3dbylfa", database: "neondb", schema: "public" };
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = message => { throw new Error(message); };
const migrationPath = path.join("prisma", "migrations", migration, "migration.sql");
const normalizeSql = value => value.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

function prisma(args, url) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const code = ((result.stderr ?? "") + (result.stdout ?? "")).match(/\bP\d{4}\b/)?.[0] ?? "CLI_FAILED";
    fail(`Prisma ${args[0]} failed (${code}); raw output suppressed.`);
  }
  return result.stdout;
}

function protect(input, decrypt = false) {
  const operation = decrypt ? "Unprotect" : "Protect";
  const script = `Add-Type -AssemblyName System.Security; $data = [Convert]::FromBase64String([Console]::In.ReadToEnd()); $result = [Security.Cryptography.ProtectedData]::${operation}($data, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    input: Buffer.from(input).toString("base64"), encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) fail("Encrypted backup verification failed; no migration will run.");
  return Buffer.from(result.stdout.trim(), "base64");
}

async function inspect(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const identity = (await client.query(`SELECT current_database() AS database, current_schema() AS schema,
      current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch,
      current_setting('neon.endpoint_id', true) AS endpoint, current_setting('transaction_read_only') AS read_only,
      now() AS observed_at, pg_current_wal_lsn()::text AS lsn`)).rows[0];
    for (const [key, value] of Object.entries(expected)) if (identity[key] !== value) fail(`STOP: database target mismatch (${key}).`);
    if (identity.read_only !== "on" || client.connection.stream.authorized !== true) fail("STOP: read-only or strict TLS verification missing.");
    const history = (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at')).rows;
    if (history.some(row => !row.finished_at && !row.rolled_back_at)) fail("STOP: failed/incomplete migration exists.");
    const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
    const dirs = fs.readdirSync("prisma/migrations", { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name).sort();
    const pending = dirs.filter(name => !applied.has(name));
    if (pending.length !== 1 || pending[0] !== migration) fail("STOP: pending migrations are not exactly the reviewed media migration.");
    for (const row of history.filter(row => row.finished_at && !row.rolled_back_at)) {
      const file = path.join("prisma/migrations", row.migration_name, "migration.sql");
      if (!fs.existsSync(file)) fail("STOP: applied migration missing locally.");
      const content = fs.readFileSync(file, "utf8");
      if (![content, content.replace(/\r\n/g, "\n"), content.replace(/\r?\n/g, "\r\n")].some(text => hash(text) === row.checksum)) fail("STOP: historical migration content changed.");
    }
    const columns = (await client.query(`SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='ProductImage' ORDER BY ordinal_position`)).rows;
    const indexes = (await client.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='ProductImage' ORDER BY indexname`)).rows;
    const constraints = (await client.query(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public."ProductImage"'::regclass ORDER BY conname`)).rows;
    const images = (await client.query('SELECT id, "productId", url, alt, "sortOrder", "isPrimary", "createdAt" FROM "ProductImage" ORDER BY id')).rows;
    return { identity, pending, history, columns, indexes, constraints, images };
  } finally { await client.query("ROLLBACK"); }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const configBytes = fs.readFileSync(".env");
  const env = dotenv.parse(configBytes);
  const original = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!original || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("Unsafe or missing database configuration.");
  const target = new URL(original);
  if (target.hostname.split(".")[0].replace(/-pooler$/, "") !== expected.endpoint || !target.hostname.endsWith(".neon.tech")) fail("STOP: configured endpoint differs from approved target.");
  target.hostname = target.hostname.replace(/-pooler\./, ".");
  target.searchParams.set("sslmode", "verify-full");
  target.searchParams.delete("options");
  if (hash(fs.readFileSync(migrationPath)) !== reviewedHash) fail("STOP: reviewed migration bytes changed.");
  const client = new Client({ connectionString: target.toString(), connectionTimeoutMillis: 15000, query_timeout: 15000, application_name: "kono-media-migration" });
  client.on("error", () => {});
  try {
    await client.connect();
    const baseline = await inspect(client);
    const diff = prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"], target.toString());
    if (normalizeSql(diff) !== normalizeSql(fs.readFileSync("docs/media-schema-diff.sql", "utf8"))) fail("STOP: schema drift differs from the reviewed media change.");
    const plain = Buffer.from(JSON.stringify({ migration, reviewedHash, directHostname: target.hostname, ...baseline }));
    const encrypted = protect(plain);
    const folder = path.join(".kono-backups", `media-${Date.now()}`);
    fs.mkdirSync(folder, { recursive: true });
    const backupPath = path.join(folder, "product-image-baseline.dpapi");
    fs.writeFileSync(backupPath, encrypted, { flag: "wx" });
    if (!protect(fs.readFileSync(backupPath), true).equals(plain)) fail("STOP: backup decrypt/roundtrip failed.");
    fs.writeFileSync(path.join(folder, "recovery-notes.md"), "# Scoped media recovery snapshot\n\nProductImage baseline rows, schema metadata and migration history are encrypted with Windows DPAPI CurrentUser. Decryption requires the same Windows account on this machine (or its DPAPI recovery keys). Decrypt was verified byte-for-byte before execution. This is a ProductImage-scoped snapshot, not a full database dump or proof of Neon PITR.\n\nThe reviewed DDL is transactional; a failed DDL transaction rolls back. For a post-commit reversal, stop media writes, review a separate corrective migration to remove only the newly added metadata columns, two unique indexes and enum, preserving every old column/row. Do not edit migration history, restore all tables, or execute destructive recovery without explicit approval. If unexpected row changes occur, recover ProductImage selectively from the encrypted baseline after reviewing references.\n");
    console.log(JSON.stringify({ stage: "preflight_passed", mode: apply ? "apply" : "read-only", target: baseline.identity, directHostname: target.hostname,
      sslmode: "verify-full", pending: baseline.pending, legacyImageCount: baseline.images.length,
      backup: backupPath, backupDecryptionVerified: true, recoveryScope: "ProductImage baseline + schema metadata; transactional DDL rollback" }));
    if (!apply) return;
    // Recheck target and history immediately before deploy. Prisma gets its own
    // immutable in-memory URL; the application environment file stays unchanged.
    const latest = await inspect(client);
    if (hash(JSON.stringify(latest.images)) !== hash(JSON.stringify(baseline.images))) fail("STOP: legacy images changed after backup.");
    if (hash(fs.readFileSync(migrationPath)) !== reviewedHash) fail("STOP: migration changed after review.");
    prisma(["migrate", "deploy"], target.toString());
    console.log(JSON.stringify({ stage: "migration_deployed", migration }));
    await client.query("BEGIN READ ONLY");
    try {
      const oldRows = (await client.query('SELECT id, "productId", url, alt, "sortOrder", "isPrimary", "createdAt" FROM "ProductImage" ORDER BY id')).rows;
      if (hash(JSON.stringify(oldRows)) !== hash(JSON.stringify(baseline.images))) fail("POSTCHECK FAILED: legacy image rows changed.");
      const metadata = (await client.query('SELECT "imageType", "cloudinaryPublicId", "cloudinaryAssetId", width, height, bytes, format FROM "ProductImage"')).rows;
      if (metadata.some(row => row.imageType !== "PRODUCT" || Object.entries(row).some(([key, value]) => key !== "imageType" && value !== null))) fail("POSTCHECK FAILED: legacy media defaults differ.");
      const indexes = (await client.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='ProductImage' ORDER BY indexname`)).rows;
      for (const name of ["ProductImage_cloudinaryPublicId_key", "ProductImage_cloudinaryAssetId_key"]) {
        if (!indexes.some(row => row.indexname === name && row.indexdef.includes("UNIQUE INDEX"))) fail("POSTCHECK FAILED: unique media index missing.");
      }
      const record = (await client.query('SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1', [migration])).rows;
      if (record.length !== 1 || !record[0].finished_at || record[0].rolled_back_at || record[0].checksum !== reviewedHash) fail("POSTCHECK FAILED: migration history mismatch.");
      console.log(JSON.stringify({ stage: "postcheck_passed", migrationRecorded: true, legacyRowsUnchanged: true, imageCount: oldRows.length,
        legacyDefaultsVerified: true, indexNames: indexes.map(row => row.indexname) }));
    } finally { await client.query("ROLLBACK"); }
    const finalDiff = prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"], target.toString());
    if (normalizeSql(finalDiff) && !/This is an empty migration/.test(finalDiff)) fail("POSTCHECK FAILED: nonempty schema diff.");
    if (hash(fs.readFileSync(".env")) !== hash(configBytes)) fail("POSTCHECK FAILED: application environment file changed.");
    console.log(JSON.stringify({ stage: "complete", schemaMatches: true, applicationEnvUnchanged: true }));
  } finally { await client.end().catch(() => {}); }
}
main().catch(error => {
  // Only our fixed messages are printable; upstream errors may contain secrets.
  const message = error instanceof Error && /^(STOP:|POSTCHECK FAILED:|Prisma |Encrypted backup|Unsafe or missing)/.test(error.message) ? error.message : "Migration check/action failed; raw error details suppressed.";
  console.error(JSON.stringify({ stage: "stopped", message })); process.exitCode = 1;
});
