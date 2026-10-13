import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@/generated/prisma/client";
import { sourceLoader } from "@/lib/testing/load-source";
import * as policy from "./media-policy";
import { createProductImageSchema, updateProductImageSchema } from "./schemas/product-image.schema";
import { uploadImageDirect, mediaRequest } from "./media-client";

const nativeRequire = createRequire(import.meta.url);
const config = { cloudName: "offline-cloud", apiKey: "offline-key", apiSecret: "offline-secret" };
const now = 1791840000000;
const file = { size: 1000, type: "image/jpeg" };
function cloudinary(fetcher: typeof fetch = async () => { throw new Error("Network forbidden in tests"); }) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync(path.resolve("src/features/products/images/cloudinary.server.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports: loaded.exports, module: loaded, Buffer, URL, Date, Error, AbortSignal,
    process: { env: { CLOUDINARY_CLOUD_NAME: config.cloudName, CLOUDINARY_API_KEY: config.apiKey, CLOUDINARY_API_SECRET: config.apiSecret } },
    fetch: fetcher, require: (name: string) => name === "server-only" ? {} : name === "./media-policy" ? policy : nativeRequire(name),
  });
  return loaded.exports as typeof import("./cloudinary.server");
}
const resource = (publicId: string) => ({ public_id: publicId, asset_id: `asset-${publicId}`, resource_type: "image", type: "upload",
  format: "jpg", bytes: 1000, width: 2000, height: 1000, version: 123,
  secure_url: `https://res.cloudinary.com/${config.cloudName}/image/upload/v123/${publicId}.jpg` });

test("file policy accepts exactly 10 MB and rejects oversized, empty, SVG, GIF, spoofed MIME and invalid size", () => {
  for (const type of policy.imageMimeTypes) assert.doesNotThrow(() => policy.validateImageFile({ size: policy.MAX_IMAGE_BYTES, type }));
  for (const patch of [{ size: policy.MAX_IMAGE_BYTES + 1 }, { size: 0 }, { size: 1.5 }, { size: NaN },
    { type: "image/svg+xml" }, { type: "image/gif" }, { type: "text/html" }]) assert.throws(() => policy.validateImageFile({ ...file, ...patch }));
});

test("signature matches Cloudinary's published SHA-256 algorithm; only fixed server fields are signed", () => {
  const cloud = cloudinary();
  const signed = cloud.createSignedUpload("p", "admin", file, config, now);
  const { createHash } = nativeRequire("node:crypto") as typeof import("node:crypto");
  const input = `allowed_formats=jpg,png,webp&overwrite=false&public_id=${signed.publicId}&timestamp=${Math.floor(now / 1000)}${config.apiSecret}`;
  assert.equal(signed.signature, createHash("sha256").update(input).digest("hex"));
  assert.equal(signed.params.overwrite, "false");
  assert.ok(signed.publicId.startsWith("kono/products/p/"));
  assert.equal(JSON.stringify(signed).includes(config.apiSecret), false);
  assert.equal(cloud.signCloudinaryParameters({ timestamp: "1315060510" }, "abcd").length, 64);
  assert.throws(() => cloud.createSignedUpload("../p", "admin", file, config, now));
});

test("upload authorization rejects tampering, expired tokens and another product, admin or resource", () => {
  const cloud = cloudinary(); const signed = cloud.createSignedUpload("p", "admin", file, config, now);
  assert.doesNotThrow(() => cloud.verifyUploadTicket(signed.uploadToken, "p", "admin", signed.publicId, config.apiSecret, now));
  for (const args of [[signed.uploadToken, "q", "admin", signed.publicId], [signed.uploadToken, "p", "other", signed.publicId],
    [signed.uploadToken, "p", "admin", "other"], [signed.uploadToken + "x", "p", "admin", signed.publicId],
    ["junk", "p", "admin", signed.publicId]]) {
    assert.throws(() => cloud.verifyUploadTicket(args[0], args[1], args[2], args[3], config.apiSecret, now));
  }
  assert.throws(() => cloud.verifyUploadTicket(signed.uploadToken, "p", "admin", signed.publicId, config.apiSecret, now + 3601000));
});

test("backend trusts only original Cloudinary image metadata, not client format/bytes/URL", () => {
  const cloud = cloudinary(); const id = "kono/products/p/id"; const asset = resource(id);
  assert.equal(cloud.verifiedResourceData(asset, id, config.cloudName).width, 2000);
  for (const patch of [{ public_id: "other" }, { resource_type: "video" }, { type: "private" }, { format: "gif" },
    { bytes: policy.MAX_IMAGE_BYTES + 1 }, { bytes: 0 }, { width: 0 }, { secure_url: "https://evil.example/a.jpg" },
    { secure_url: asset.secure_url.replace("https:", "http:") }, { secure_url: asset.secure_url.replace("/upload/", "/upload/c_crop,w_100/") },
    { secure_url: asset.secure_url + "?extra=1" }]) assert.throws(() => cloud.verifiedResourceData({ ...asset, ...patch }, id, config.cloudName));
});

test("server verifies through authenticated Admin API and redacts upstream failures", async () => {
  const id = "kono/products/p/id";
  let lookups = 0;
  const cloud = cloudinary((async (url, init) => {
    lookups++; assert.equal(url, `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${encodeURIComponent(id)}`);
    assert.equal((init?.headers as Record<string, string>).Authorization, `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`);
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    return Response.json(resource(id));
  }) as typeof fetch);
  assert.equal((await cloud.verifyCloudinaryResource(id)).bytes, 1000); assert.equal(lookups, 1);
  for (const fetcher of [async () => Response.json({ error: config.apiSecret }, { status: 401 }), async () => { throw new Error(config.apiSecret); }]) {
    await assert.rejects(cloudinary(fetcher).verifyCloudinaryResource(id), error => error instanceof Error && !error.message.includes(config.apiSecret));
  }
});

type Image = policy.MediaImage;
const oldImage = (index: number): Image => ({ id: `old-${index}`, productId: "p", url: `https://legacy.example/${index}.jpg`, alt: "Legacy image",
  sortOrder: index, isPrimary: index === 0, imageType: "PRODUCT" });
function gallery(count = 1, status = "DRAFT", invalidResource = false, failCreate = false) {
  let images = Array.from({ length: count }, (_, index) => oldImage(index));
  const calls: string[] = []; let queue = Promise.resolve(); let locked = false;
  const findMany = async (query: { where: { id?: { not: string } } }) => structuredClone(images.filter(image => image.id !== query.where.id?.not));
  const tx = { productImage: {
    findMany, findUnique: async (query: { where: { id: string } }) => structuredClone(images.find(image => image.id === query.where.id) ?? null),
    create: async (query: { data: Image }) => { assert.equal(locked, true); calls.push("create"); if (failCreate) throw new Error("Synthetic database conflict"); const image = { ...query.data, id: `new-${images.length}` }; images.push(image); return structuredClone(image); },
    updateMany: async (query: { data: Partial<Image> }) => { assert.equal(locked, true); calls.push("updateMany"); images = images.map(image => ({ ...image, ...query.data })); return { count: images.length }; },
    update: async (query: { where: { id: string }; data: Partial<Image> }) => { assert.equal(locked, true); calls.push("update"); const image = images.find(image => image.id === query.where.id)!; Object.assign(image, query.data); return structuredClone(image); },
    delete: async (query: { where: { id: string } }) => { assert.equal(locked, true); calls.push("delete"); images = images.filter(image => image.id !== query.where.id); },
  }, product: { findUnique: async () => ({ status }) }, $queryRaw: async (sql: { sql: string }) => { assert.match(sql.sql, /"Product".*FOR UPDATE/); locked = true; calls.push("lock"); return [{ id: "p" }]; } };
  const prisma = { ...tx, $transaction: <T>(callback: (client: typeof tx) => Promise<T>) => {
    const result = queue.then(async () => { const before = structuredClone(images); try { return await callback(tx); }
      catch (error) { images = before; throw error; } finally { locked = false; } });
    queue = result.then(() => undefined, () => undefined); return result;
  } };
  const cloud = cloudinary();
  const load = sourceLoader({ "@/lib/db/prisma": { prisma }, "@/generated/prisma/client": { Prisma },
    [path.resolve("src/features/products/images/cloudinary.server")]: {
      ...cloud, verifyCloudinaryResource: async (id: string) => { calls.push("verify"); if (invalidResource) throw new policy.MediaError("Invalid resource"); return cloud.verifiedResourceData(resource(id), id, config.cloudName); },
    },
  });
  const service = load("src/features/products/images/services/product-image.service.ts").productImageService as typeof import("./services/product-image.service").productImageService;
  const input = () => { const signed = cloud.createSignedUpload("p", "admin", file); return { productId: "p", publicId: signed.publicId, uploadToken: signed.uploadToken, imageType: "MULTI_VIEW" as const }; };
  return { service, calls, input, images: () => images };
}

test("new images are verified before writes and preserve every existing image field", async () => {
  const fixture = gallery(); const old = structuredClone(fixture.images()[0]);
  const saved = await fixture.service.createImage(fixture.input(), "admin");
  assert.equal(saved.imageType, "MULTI_VIEW"); assert.equal(saved.isPrimary, false);
  assert.deepEqual(fixture.images()[0], old); assert.deepEqual(fixture.calls.slice(0, 3), ["verify", "lock", "create"]);
  const invalid = gallery(1, "DRAFT", true);
  await assert.rejects(invalid.service.createImage(invalid.input(), "admin")); assert.deepEqual(invalid.calls, ["verify"]);
});

test("24-image limit is enforced under the real repository's per-product lock, including concurrent attachment", async () => {
  const full = gallery(24); await assert.rejects(full.service.createImage(full.input(), "admin"), /24 images/); assert.equal(full.images().length, 24);
  const fixture = gallery(23);
  const results = await Promise.allSettled([fixture.service.createImage(fixture.input(), "admin"), fixture.service.createImage(fixture.input(), "admin")]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1); assert.equal(fixture.images().length, 24);
});

test("primary switches atomically and first upload becomes primary", async () => {
  const fixture = gallery(2);
  await fixture.service.updateImage({ id: "old-1", isPrimary: true });
  assert.deepEqual(fixture.images().map(image => image.isPrimary), [false, true]);
  await assert.rejects(fixture.service.updateImage({ id: "old-1", isPrimary: false }), /another Primary/);
  const empty = gallery(0); assert.equal((await empty.service.createImage(empty.input(), "admin")).isPrimary, true);
});

test("attachment retry after a lost response is idempotent even at the 24-image limit", async () => {
  const fixture = gallery(23); const input = fixture.input();
  const first = await fixture.service.createImage(input, "admin");
  const second = await fixture.service.createImage(input, "admin");
  assert.equal(first.id, second.id); assert.equal(fixture.images().length, 24);
  assert.equal(fixture.calls.filter(call => call === "create").length, 1);
});

test("failed attachment rolls back the previous Primary Image and keeps legacy metadata", async () => {
  const fixture = gallery(1, "DRAFT", false, true); const before = structuredClone(fixture.images());
  await assert.rejects(fixture.service.createImage({ ...fixture.input(), isPrimary: true }, "admin"), /Synthetic database conflict/);
  assert.deepEqual(fixture.images(), before); assert.ok(fixture.calls.includes("updateMany"));
});

test("reorder requires an exact permutation and leaves URLs and IDs intact", async () => {
  const fixture = gallery(3);
  for (const ids of [["old-0", "old-0", "old-2"], ["old-1"], ["old-0", "other", "old-2"]]) await assert.rejects(fixture.service.reorderImages("p", ids), /gallery changed/);
  await fixture.service.reorderImages("p", ["old-2", "old-0", "old-1"]);
  assert.deepEqual(fixture.images().map(image => image.sortOrder), [1, 2, 0]); assert.equal(fixture.images()[0].url, oldImage(0).url);
});

test("confirmed removal reselects primary; last ACTIVE image is protected; legacy originals are never destroyed", async () => {
  const fixture = gallery(2); await fixture.service.deleteImage("old-0");
  assert.equal(fixture.images().length, 1); assert.equal(fixture.images()[0].isPrimary, true);
  assert.equal(fixture.calls.includes("verify"), false);
  const active = gallery(1, "ACTIVE"); await assert.rejects(active.service.deleteImage("old-0"), /ACTIVE product needs an image/);
  assert.equal(active.images().length, 1); assert.equal(active.calls.includes("delete"), false);
});

test("legacy image URL replacement and unsigned creation are rejected; product bulk images cannot bypass verification", () => {
  assert.equal(createProductImageSchema.safeParse({ productId: "p", url: "https://evil.example/a.jpg" }).success, false);
  assert.equal(updateProductImageSchema.safeParse({ id: "old", url: "https://evil.example/a.jpg" }).success, false);
  assert.throws(() => policy.rejectInlineImages([{}])); assert.throws(() => policy.rejectInlineImages([], true));
  assert.doesNotThrow(() => policy.rejectInlineImages([])); assert.doesNotThrow(() => policy.rejectInlineImages(undefined, true));
});

test("direct browser upload uses only the Cloudinary image endpoint, sends no cookies and trusts no response metadata", async () => {
  const cloud = cloudinary(); const signed = cloud.createSignedUpload("p", "admin", file, config, now);
  const actual = new File(["synthetic"], "test.jpg", { type: "image/jpeg" }); let called = false;
  await uploadImageDirect(actual, signed, (async (url, init) => {
    called = true; assert.equal(url, signed.uploadUrl); assert.equal(init?.credentials, "omit");
    const body = init?.body as FormData;
    assert.equal(body.get("overwrite"), "false"); assert.equal(body.get("allowed_formats"), "jpg,png,webp");
    assert.equal(body.has("api_secret"), false); assert.equal(body.has("uploadToken"), false);
    return Response.json({ secure_url: "https://evil.example/untrusted" });
  }) as typeof fetch); assert.equal(called, true);
  await assert.rejects(uploadImageDirect(actual, { ...signed, uploadUrl: "https://evil.example/upload" }), /Invalid upload destination/);
  await assert.rejects(uploadImageDirect(actual, signed, async () => Response.json({ error: config.apiSecret }, { status: 400 })), error => error instanceof Error && !error.message.includes(config.apiSecret));
});

test("media client detects expired admin session and malformed envelopes", async () => {
  await assert.rejects(mediaRequest("/api/test", policy.mediaImageSchema, {}, async () => Response.json({}, { status: 401 })), /session expired/);
  await assert.rejects(mediaRequest("/api/test", policy.mediaImageSchema, {}, async () => Response.json({ success: true, data: {} })), /Unexpected/);
});

test("signed upload rejects cross-site requests before any media service runs", async () => {
  let calls = 0;
  const load = sourceLoader({
    "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { id: "admin" } }) },
    "@/features/products/images/services/product-image.service": { productImageService: { signUpload: async () => { calls++; } } },
  });
  const post = load("src/app/api/admin/media/sign/route.ts").POST as (request: Request) => Promise<Response>;
  const response = await post(new Request("https://kono.example/api/admin/media/sign", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }));
  assert.equal(response.status, 403); assert.equal(calls, 0);
});
