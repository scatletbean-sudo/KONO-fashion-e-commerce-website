import assert from "node:assert/strict";
import test from "node:test";
import { assertMediaDevelopmentIdentity, assertMediaDevelopmentUrl, mediaDevelopmentTarget, mediaRequestOrigin } from "./media-dev-runtime";

const dev = "postgresql://synthetic:synthetic@ep-lucky-fire-b3froe7u-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";
test("local runtime accepts the exact strict dev URL and rejects production, weak SSL and missing configuration", () => {
  assert.doesNotThrow(() => assertMediaDevelopmentUrl(dev));
  for (const url of [undefined, dev.replace("ep-lucky-fire-b3froe7u", "ep-fragrant-pine-b3qx5bzw"), dev.replace("ep-lucky-fire-b3froe7u", "ep-icy-butterfly-b3dbylfa"), dev.replace("verify-full", "require"), dev.replace("/neondb?", "/other?")]) {
    assert.throws(() => assertMediaDevelopmentUrl(url));
  }
});
test("runtime identity must prove the actual dev branch, endpoint, database, schema and read-only transaction", () => {
  const identity = { ...mediaDevelopmentTarget, readOnly: "on" };
  assert.doesNotThrow(() => assertMediaDevelopmentIdentity(identity));
  for (const patch of [{ branch: "br-quiet-block-b38k6k1x" }, { branch: "br-dry-pine-b3l81xxy" }, { endpoint: "ep-fragrant-pine-b3qx5bzw" }, { endpoint: "ep-icy-butterfly-b3dbylfa" }, { database: "other" }, { schema: "other" }, { project: "other" }, { readOnly: "off" }]) {
    assert.throws(() => assertMediaDevelopmentIdentity({ ...identity, ...patch }));
  }
});
test("local media origin handles only the explicit loopback alias without allowing foreign origins", () => {
  const request = new Request("http://localhost:3001/api/admin/media/sign", { headers: { host: "127.0.0.1:3001" } });
  assert.equal(mediaRequestOrigin(request, true), "http://127.0.0.1:3001");
  assert.equal(mediaRequestOrigin(request, false), "http://localhost:3001");
  const foreign = new Request("https://kono.example/api/admin/media/sign", { headers: { host: "evil.example" } });
  assert.equal(mediaRequestOrigin(foreign, true), "https://kono.example");
});
