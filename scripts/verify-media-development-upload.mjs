// Read-only verification after the user's manual upload. Never uploads, updates,
// deletes, or prints credentials, cookies, hashes or original image URLs.
import fs from "node:fs";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const productId = "cmuedw86k0000q0ufukh57s7m";
const expected = { project: "hidden-forest-64993760", branch: "br-quiet-block-b38k6k1x", endpoint: "ep-fragrant-pine-b3qx5bzw", database: "neondb", schema: "public" };
const fail = message => { throw new Error(message); };
function originalSnapshot() {
  const cipher = fs.readFileSync(".kono-backups/media-1791891277529/product-image-baseline.dpapi");
  const script = "Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $plain=[Security.Cryptography.ProtectedData]::Unprotect($data,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($plain))";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { input: cipher.toString("base64"), encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) fail("Could not verify the local encrypted image baseline.");
  return JSON.parse(Buffer.from(result.stdout.trim(), "base64").toString("utf8")).images.filter(image => image.productId === productId);
}

async function main() {
  const file = dotenv.parse(fs.readFileSync(".env"));
  const settings = { ...file, ...process.env };
  const url = new URL(settings.KONO_MEDIA_DEV_DATABASE_URL ?? "");
  if (!url.hostname.endsWith(".neon.tech") || url.hostname.split(".")[0].replace(/-pooler$/, "") !== expected.endpoint
    || decodeURIComponent(url.pathname.slice(1)) !== expected.database || settings.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("Wrong or unsafe development configuration.");
  url.searchParams.set("sslmode", "verify-full");
  const runtimeResponse = await fetch("http://127.0.0.1:3001/api/media-dev/runtime", { signal: AbortSignal.timeout(15000) });
  const runtime = await runtimeResponse.json();
  if (!runtimeResponse.ok || !runtime.success || Object.entries(expected).some(([key, value]) => runtime.identity?.[key] !== value)) fail("Next.js runtime identity did not match development.");
  const baseline = originalSnapshot();
  const client = new Client({ connectionString: url.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  client.on("error", () => {});
  try {
    await client.connect(); await client.query("BEGIN READ ONLY");
    const identity = (await client.query(`SELECT current_database() AS database,current_schema() AS schema,
      current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
      current_setting('neon.endpoint_id',true) AS endpoint`)).rows[0];
    if (Object.entries(expected).some(([key, value]) => identity[key] !== value) || client.connection.stream.authorized !== true) fail("Database identity/TLS did not match development.");
    const product = (await client.query('SELECT id,name,status FROM "Product" WHERE id=$1', [productId])).rows[0];
    if (product?.status !== "DRAFT") fail("Product status is no longer DRAFT; stopping verification.");
    const images = (await client.query('SELECT * FROM "ProductImage" WHERE "productId"=$1 ORDER BY "sortOrder",id', [productId])).rows;
    const oldImagesPreserved = baseline.every(old => images.some(image => image.id === old.id && image.url === old.url && image.alt === old.alt));
    if (!oldImagesPreserved) fail("An old image ID, URL or Alt Text changed or disappeared.");
    const newImages = images.filter(image => !baseline.some(old => old.id === image.id));
    if (newImages.length > 1) fail("More than one new image exists; stopping outside the approved single-image test.");
    const primaryCount = images.filter(image => image.isPrimary).length;
    const orderingUnique = new Set(images.map(image => image.sortOrder)).size === images.length;
    if (newImages.length && (primaryCount !== 1 || !orderingUnique)) fail("Image primary/order invariants failed after manual upload.");
    const report = { identity, product, oldImageCount: baseline.length, oldImagesPreserved, imageCount: images.length,
      primaryCount, orderingUnique,
      oldOrderingAndPrimary: baseline.map(old => { const current = images.find(image => image.id === old.id); return { id: old.id, sortOrder: current.sortOrder, isPrimary: current.isPrimary }; }),
      newImages: [] };
    for (const image of newImages) {
      if (!image.cloudinaryPublicId || !image.cloudinaryAssetId || !image.cloudinaryPublicId.startsWith(`kono/products/${productId}/`)) fail("New image lacks verified Cloudinary identity.");
      const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = settings;
      if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) fail("Cloudinary verification configuration is missing.");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${encodeURIComponent(image.cloudinaryPublicId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, redirect: "error", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) fail("Cloudinary read-only resource verification failed.");
      const resource = await response.json();
      if (resource.public_id !== image.cloudinaryPublicId || resource.asset_id !== image.cloudinaryAssetId || resource.resource_type !== "image"
        || resource.type !== "upload" || !["jpg", "png", "webp"].includes(resource.format) || resource.bytes > 10 * 1024 * 1024
        || resource.bytes !== image.bytes || resource.width !== image.width || resource.height !== image.height
        || resource.format !== image.format || resource.secure_url !== image.url) fail("Cloudinary metadata does not match the saved image.");
      report.newImages.push({ id: image.id, cloudinaryResourceVerified: true, imageType: image.imageType, alt: image.alt,
        sortOrder: image.sortOrder, isPrimary: image.isPrimary, bytes: image.bytes, width: image.width, height: image.height, format: image.format });
    }
    console.log(JSON.stringify({ ...report, result: newImages.length ? "manual_upload_verified" : "waiting_for_manual_upload" }));
    await client.query("ROLLBACK");
  } finally { await client.end().catch(() => {}); }
}
main().catch(() => { console.error("Read-only media upload verification failed; raw sensitive details suppressed."); process.exitCode = 1; });
