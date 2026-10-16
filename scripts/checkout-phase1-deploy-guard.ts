import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { checkoutDevelopmentConnection } from "./checkout-phase1-preflight";

export const checkoutMigration = "20261017000000_checkout_v1_foundation";
export const reviewedChecksum = "00a2f7546d76215c687163e5e80f2cae0cb75a5305fe970d23aa4915062d0f5e";
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function guard(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function assertDistinctProduction(settings: Record<string, string | undefined>) {
  const connection = checkoutDevelopmentConnection(settings);
  // Inspect configured endpoint only; never connect to or print production.
  const production = new URL(settings.DATABASE_URL ?? "");
  guard(["postgres:", "postgresql:"].includes(production.protocol), "Production endpoint cannot be established");
  const endpoint = (url: URL) => url.hostname.split(".")[0].replace(/-pooler$/, "");
  guard(endpoint(production) !== endpoint(new URL(connection)), "Development and production endpoints must differ");
  return connection;
}
export function assertOnlyApprovedPending(names: string[]) {
  guard(names.length === 1 && names[0] === checkoutMigration, "Pending list differs from reviewed migration");
}
export function assertReviewedSqlTlsGuard(serverSsl: unknown) {
  guard(serverSsl === true, "Reviewed SQL TLS guard cannot pass: pg_stat_ssl.ssl is not true; stop before deployment");
}
export function checksumMatches(content: string, expected: string) {
  return [content, content.replace(/\r\n/g, "\n"), content.replace(/\r?\n/g, "\r\n")].some(value => sha256(value) === expected);
}
export function deploymentConfiguration(settings: Record<string, string | undefined>, args: string[]) {
  guard(settings.KONO_CHECKOUT_PHASE1_REVIEWED_CHECKSUM === reviewedChecksum, "Runner verification marker missing");
  const deploy = args[0] === "migrate" && args[1] === "deploy";
  const diff = args[0] === "migrate" && args[1] === "diff" && args.includes("--from-config-datasource") && args.includes("--to-schema");
  guard(deploy || diff, "Only guarded diff or deploy is permitted");
  const url = new URL(checkoutDevelopmentConnection(settings));
  if (deploy) url.searchParams.set("options", "-c search_path=public");
  const staged = path.resolve(settings.KONO_CHECKOUT_PHASE1_MIGRATIONS_PATH ?? "");
  const backupRoot = path.resolve(".kono-backups");
  const relative = path.relative(backupRoot, staged);
  guard(relative.startsWith("checkout-phase1-deploy-") && !relative.includes("..") && !path.isAbsolute(relative) && path.basename(staged) === "migrations", "Invalid isolated migration directory");
  guard(sha256(fs.readFileSync(path.join(staged, checkoutMigration, "migration.sql"))) === reviewedChecksum, "Staged migration checksum changed");
  const manifest = JSON.parse(fs.readFileSync(path.join(staged, "..", "manifest.json"), "utf8")) as Record<string, string>;
  const names = fs.readdirSync(staged, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name).sort();
  guard(JSON.stringify(names) === JSON.stringify(Object.keys(manifest).sort()), "Staged migration list changed");
  for (const name of names) guard(sha256(fs.readFileSync(path.join(staged, name, "migration.sql"))) === manifest[name], "Staged history changed");
  return { url: url.toString(), staged };
}
