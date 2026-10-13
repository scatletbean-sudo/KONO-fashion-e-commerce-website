// Read-only preflight. Never print credentials, connection strings, raw errors or image URLs.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { Client } from "pg";
import nextEnv from "@next/env";

async function main() {
  const inherited = { ...process.env };
  const env = fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {};
  const connectionString = inherited.DATABASE_URL ?? env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing configuration");
  const target = new URL(connectionString);
  const identifiers = value => {
    const u = new URL(value);
    return { hostname: u.hostname, endpointId: u.hostname.split(".")[0].replace(/-pooler$/, ""), database: decodeURIComponent(u.pathname.slice(1)), sslmode: u.searchParams.get("sslmode") };
  };
  console.log(JSON.stringify({ prismaTarget: identifiers(connectionString), source: inherited.DATABASE_URL ? "process.env" : ".env" }));
  for (const development of [true, false]) {
    nextEnv.resetEnv();
    nextEnv.loadEnvConfig(process.cwd(), development, { info() {}, error() {} }, true);
    const value = process.env.DATABASE_URL;
    console.log(JSON.stringify({ nextEnvironment: development ? "development" : "production", target: value ? identifiers(value) : null, sameConnectionAsPrisma: value === connectionString }));
  }
  if (!target.hostname.endsWith(".neon.tech") || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Unsafe audit target");
  // Transient strict SSL for this audit only. No environment file is changed.
  target.searchParams.set("sslmode", "verify-full");
  target.searchParams.delete("options");
  const client = new Client({ connectionString: target.toString(), connectionTimeoutMillis: 15000, query_timeout: 10000, application_name: "kono-media-readonly-preflight" });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const identity = await client.query(`SELECT current_database() AS database, current_schema() AS schema,
      current_setting('transaction_read_only') AS read_only,
      current_setting('neon.project_id', true) AS project_id,
      current_setting('neon.branch_id', true) AS branch_id,
      current_setting('neon.endpoint_id', true) AS endpoint_id`);
    console.log(JSON.stringify({ databaseIdentity: identity.rows[0], tlsAuthorized: client.connection.stream.authorized === true }));
    const columns = await client.query(`SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductImage' ORDER BY ordinal_position`);
    console.log(JSON.stringify({ productImageColumns: columns.rows }));
    const enums = await client.query(`SELECT n.nspname AS schema, t.typname AS name, e.enumlabel AS value
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE t.typname='ProductImageType' ORDER BY e.enumsortorder`);
    console.log(JSON.stringify({ existingMediaEnum: enums.rows }));
    const indexes = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='ProductImage'`);
    console.log(JSON.stringify({ productImageIndexes: indexes.rows }));
    const constraints = await client.query(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public."ProductImage"'::regclass`);
    console.log(JSON.stringify({ productImageConstraints: constraints.rows }));
    const counts = await client.query(`SELECT count(*)::int AS image_count, count(DISTINCT "productId")::int AS products_with_images,
      count(*) FILTER (WHERE "isPrimary")::int AS primary_count FROM "ProductImage"`);
    console.log(JSON.stringify({ existingImageCounts: counts.rows[0] }));
    const grouping = await client.query(`SELECT count(*) FILTER (WHERE total>24)::int AS products_over_limit,
      count(*) FILTER (WHERE primaries>1)::int AS products_with_multiple_primary,
      count(*) FILTER (WHERE primaries=0)::int AS products_without_primary
      FROM (SELECT count(*) AS total, count(*) FILTER (WHERE "isPrimary") AS primaries FROM "ProductImage" GROUP BY "productId") s`);
    console.log(JSON.stringify({ existingGalleryAnomalies: grouping.rows[0] }));
    const migrations = await client.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`);
    const dirs = fs.readdirSync("prisma/migrations", { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name).sort();
    const applied = new Set();
    console.log(JSON.stringify({ migrationHistory: migrations.rows.map(row => {
      if (row.finished_at && !row.rolled_back_at) applied.add(row.migration_name);
      const file = path.join("prisma/migrations", row.migration_name, "migration.sql");
      const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      const hash = value => createHash("sha256").update(value).digest("hex");
      return { name: row.migration_name, finished: !!row.finished_at, rolledBack: !!row.rolled_back_at,
        localChecksumMatches: content !== null ? hash(content) === row.checksum : null,
        lfChecksumMatches: content !== null ? hash(content.replace(/\r\n/g, "\n")) === row.checksum : null,
        crlfChecksumMatches: content !== null ? hash(content.replace(/\r?\n/g, "\r\n")) === row.checksum : null };
    }), pendingLocalMigrations: dirs.filter(name => !applied.has(name)) }));
    await client.query("ROLLBACK");
  } finally { await client.end().catch(() => {}); }
}
main().catch(error => {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : "AUDIT_FAILED";
  console.error(JSON.stringify({ error: code, message: "Read-only preflight could not complete; raw error details suppressed." }));
  process.exitCode = 1;
});
