import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";

type Configuration = { schema: string; migrations: { path: string }; datasource: { url: string } };
function loadConfig(values: Record<string, string>) {
  const requested: string[] = [];
  const load = sourceLoader({
    "dotenv/config": {},
    "prisma/config": { defineConfig: (value: Configuration) => value, env: (name: string) => {
      requested.push(name); if (!(name in values)) throw new Error("Missing synthetic development configuration"); return values[name];
    } },
  });
  return { config: load("prisma.media-dev.config.ts").default as Configuration, requested };
}
const dev = "postgresql://synthetic:synthetic@ep-fragrant-pine-b3qx5bzw-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const prod = "postgresql://synthetic:synthetic@ep-icy-butterfly-b3dbylfa-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

test("development CLI uses only its dedicated variable, direct endpoint, strict SSL and unchanged channel binding", () => {
  const loaded = loadConfig({ DATABASE_URL: prod, KONO_MEDIA_DEV_DATABASE_URL: dev });
  assert.deepEqual(loaded.requested, ["KONO_MEDIA_DEV_DATABASE_URL"]);
  const url = new URL(loaded.config.datasource.url);
  assert.equal(url.hostname, "ep-fragrant-pine-b3qx5bzw.c-4.ap-southeast-1.aws.neon.tech");
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.equal(url.searchParams.get("channel_binding"), "require");
  assert.equal(loaded.config.schema, "prisma/schema.prisma"); assert.equal(loaded.config.migrations.path, "prisma/migrations");
});
test("missing development variable never falls back to production", () => {
  assert.throws(() => loadConfig({ DATABASE_URL: prod }), /Missing synthetic/);
});
test("a production URL disguised as the development variable is rejected", () => {
  assert.throws(() => loadConfig({ KONO_MEDIA_DEV_DATABASE_URL: prod }), /does not match/);
});
test("development CLI rejects another database, scheme or non-Neon hostname", () => {
  for (const url of [dev.replace("/neondb?", "/other?"), dev.replace("postgresql:", "https:"), dev.replace(".aws.neon.tech", ".evil.example")]) {
    assert.throws(() => loadConfig({ KONO_MEDIA_DEV_DATABASE_URL: url }), /does not match/);
  }
});
