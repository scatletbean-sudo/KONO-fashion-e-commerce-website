import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { assertDistinctProduction, assertOnlyApprovedPending, assertReviewedSqlTlsGuard, checkoutMigration, checksumMatches, reviewedChecksum, sha256 } from "./checkout-phase1-deploy-guard";
import { sourceLoader } from "../src/lib/testing/load-source";
import { checkoutDevelopmentConnection } from "./checkout-phase1-preflight";

const dev = "postgresql://offline:offline@ep-lucky-fire-b3froe7u-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb";
test("preflight must evaluate the reviewed SQL TLS predicate before any deployment", () => {
  assert.doesNotThrow(() => assertReviewedSqlTlsGuard(true));
  for (const value of [false, undefined, null, "true"]) assert.throws(() => assertReviewedSqlTlsGuard(value));
});
test("deployment requires distinct approved Development and never uses production as fallback", () => {
  assert.throws(() => assertDistinctProduction({ DATABASE_URL: dev }));
  assert.throws(() => assertDistinctProduction({ KONO_MEDIA_DEV_DATABASE_URL: dev }));
  assert.throws(() => assertDistinctProduction({ KONO_MEDIA_DEV_DATABASE_URL: dev, DATABASE_URL: dev.replace("-pooler", "") }));
  const production = dev.replace("ep-lucky-fire-b3froe7u", "ep-other-offline");
  assert.match(assertDistinctProduction({ KONO_MEDIA_DEV_DATABASE_URL: dev, DATABASE_URL: production }), /ep-lucky-fire-b3froe7u/);
  assert.throws(() => assertDistinctProduction({ KONO_MEDIA_DEV_DATABASE_URL: production, DATABASE_URL: dev }));
});
test("pending set must be exactly the approved migration and reviewed SQL bytes must match", () => {
  assert.doesNotThrow(() => assertOnlyApprovedPending([checkoutMigration]));
  for (const names of [[], ["other"], [checkoutMigration, "other"]]) assert.throws(() => assertOnlyApprovedPending(names));
  const sql = fs.readFileSync(`prisma/migrations/${checkoutMigration}/migration.sql`, "utf8");
  assert.equal(sha256(sql), reviewedChecksum);
  assert.equal(checksumMatches(sql + "\n-- changed", reviewedChecksum), false);
});
test("runner-only config validates immutable staged list and enables writes only for deploy", () => {
  const staged = path.resolve(".kono-backups/checkout-phase1-deploy-offline/migrations");
  const sql = fs.readFileSync(`prisma/migrations/${checkoutMigration}/migration.sql`, "utf8");
  let manifest: Record<string, string> = { [checkoutMigration]: reviewedChecksum };
  let directories = [checkoutMigration];
  const load = sourceLoader({ [path.resolve("scripts/checkout-phase1-preflight")]: { checkoutDevelopmentConnection }, "node:fs": {
    readFileSync: (file: string) => file.endsWith("manifest.json") ? JSON.stringify(manifest) : Buffer.from(sql),
    readdirSync: () => directories.map(name => ({ name, isDirectory: () => true })),
  } });
  const { deploymentConfiguration } = load("scripts/checkout-phase1-deploy-guard.ts") as typeof import("./checkout-phase1-deploy-guard");
  const settings = { KONO_MEDIA_DEV_DATABASE_URL: dev, KONO_CHECKOUT_PHASE1_REVIEWED_CHECKSUM: reviewedChecksum, KONO_CHECKOUT_PHASE1_MIGRATIONS_PATH: staged };
  assert.match(new URL(deploymentConfiguration(settings, ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma"]).url).searchParams.get("options")!, /default_transaction_read_only=on/);
  assert.equal(new URL(deploymentConfiguration(settings, ["migrate", "deploy"]).url).searchParams.get("options"), "-c search_path=public");
  for (const args of [["migrate", "dev"], ["migrate", "reset"], ["db", "push"]]) assert.throws(() => deploymentConfiguration(settings, args));
  assert.throws(() => deploymentConfiguration({ ...settings, KONO_CHECKOUT_PHASE1_REVIEWED_CHECKSUM: "wrong" }, ["migrate", "deploy"]));
  assert.throws(() => deploymentConfiguration({ ...settings, KONO_CHECKOUT_PHASE1_MIGRATIONS_PATH: "C:/outside/migrations" }, ["migrate", "deploy"]));
  directories = [checkoutMigration, "unexpected"];
  assert.throws(() => deploymentConfiguration(settings, ["migrate", "deploy"]));
  directories = [checkoutMigration]; manifest = { [checkoutMigration]: "wrong" };
  assert.throws(() => deploymentConfiguration(settings, ["migrate", "deploy"]));
});
