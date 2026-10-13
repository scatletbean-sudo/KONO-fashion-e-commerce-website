// Scoped development-only reset. Secrets arrive through stdin, never arguments.
import fs from "node:fs";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { Client } from "pg";

const expected = { project: "hidden-forest-64993760", branch: "br-quiet-block-b38k6k1x", endpoint: "ep-fragrant-pine-b3qx5bzw", database: "neondb", schema: "public" };
const email = "admin@kono.local";
const guard = condition => { if (!condition) throw new Error("Stopped"); };
async function identity(client) {
  const row = (await client.query(`SELECT current_database() AS database,current_schema() AS schema,
    current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
    current_setting('neon.endpoint_id',true) AS endpoint`)).rows[0];
  guard(Object.entries(expected).every(([key, value]) => row[key] === value));
  guard(client.connection.stream.authorized === true);
  return row;
}
async function main() {
  guard(["--check", "--reset"].includes(process.argv[2]) && process.argv.length === 3);
  const settings = { ...dotenv.parse(fs.readFileSync(".env")), ...process.env };
  guard(settings.NODE_TLS_REJECT_UNAUTHORIZED !== "0");
  const url = new URL(settings.KONO_MEDIA_DEV_DATABASE_URL ?? "");
  guard(["postgres:", "postgresql:"].includes(url.protocol) && url.hostname.endsWith(".neon.tech")
    && url.hostname.split(".")[0].replace(/-pooler$/, "") === expected.endpoint
    && decodeURIComponent(url.pathname.slice(1)) === expected.database);
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.set("sslmode", "verify-full");
  const response = await fetch("http://127.0.0.1:3001/api/media-dev/runtime", { signal: AbortSignal.timeout(15000) });
  const runtime = await response.json();
  guard(response.ok && runtime.success && Object.entries(expected).every(([key, value]) => runtime.identity?.[key] === value));
  const client = new Client({ connectionString: url.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const verified = await identity(client);
    const account = (await client.query('SELECT id,email,role,status FROM public."User" WHERE email=$1', [email])).rows[0];
    guard(account?.role === "ADMIN" && account.status === "ACTIVE");
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ identity: verified, account: { email, role: account.role, status: account.status }, result: "read_only_verified" }));
    if (process.argv[2] === "--check") return;
    guard(!process.stdin.isTTY);
    const chunks = [];
    for await (const chunk of process.stdin) { chunks.push(chunk); guard(chunks.reduce((n, c) => n + c.length, 0) <= 4096); }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    guard(typeof input.password === "string" && input.password === input.confirm
      && input.password.length >= 12 && Buffer.byteLength(input.password, "utf8") <= 72);
    const hash = await bcrypt.hash(input.password, 12);
    guard(await bcrypt.compare(input.password, hash));
    await client.query("BEGIN");
    await identity(client);
    const before = (await client.query('SELECT * FROM public."User" WHERE id=$1 FOR UPDATE', [account.id])).rows[0];
    guard(before?.email === email && before.role === "ADMIN" && before.status === "ACTIVE");
    guard((await client.query('UPDATE public."User" SET "passwordHash"=$1 WHERE id=$2', [hash, account.id])).rowCount === 1);
    const after = (await client.query('SELECT * FROM public."User" WHERE id=$1', [account.id])).rows[0];
    guard(Object.keys(before).every(key => key === "passwordHash" || JSON.stringify(before[key]) === JSON.stringify(after[key])));
    guard(await bcrypt.compare(input.password, after.passwordHash));
    await client.query("COMMIT");
    console.log("Password reset completed on verified development branch. Only passwordHash changed.");
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); }
}
main().catch(() => { console.error("Reset stopped or failed. No sensitive error details displayed; check runtime, account, and password rules. If interrupted around COMMIT, check login before retrying."); process.exitCode = 1; });
