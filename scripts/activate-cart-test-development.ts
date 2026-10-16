import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";
import { verify, sourceFingerprint, testProduct } from "./create-cart-test-development";
import { assertMediaDevelopmentIdentity, assertMediaDevelopmentUrl } from "../src/features/products/images/media-dev-runtime";
import { validProductImage, validateProductUpdate } from "../src/features/products/attributes/product-update-validation";
import type { Prisma } from "../src/generated/prisma/client";
import { inventoryValuesSchema } from "../src/features/inventory/schemas/inventory-values.schema";
import { stockLimit } from "../src/features/cart/cart-contract";

const targetId = "test-cart-55cfed3e-9e64-4cd9-a530-cd3bf81d77aa";
const sourceId = "cmuedw86k0000q0ufukh57s7m";
export const fixtures = [ { size: "M", isActive: true, quantity: 2 }, { size: "L", isActive: true, quantity: 0 }, { size: "XL", isActive: false, quantity: 5 } ] as const;
function guard(value: unknown): asserts value { if (!value) throw new Error("TEST activation verification failed."); }
type Row = Record<string, unknown>;
export function assertTarget(product: Row) {
  guard(product?.id === targetId && product.name === testProduct.name && product.slug === testProduct.slug && product.basePrice === 899000 && ["DRAFT", "ACTIVE"].includes(String(product.status)));
}
export function assertAsset(image: Row, asset: Row, cloud: string) {
  guard(image.productId === targetId && image.imageType === "MULTI_VIEW" && image.isPrimary === true);
  guard(typeof image.cloudinaryPublicId === "string" && image.cloudinaryPublicId.startsWith(`kono/products/${targetId}/`));
  guard(image.cloudinaryPublicId === asset.public_id && image.cloudinaryAssetId === asset.asset_id && image.url === asset.secure_url);
  guard(asset.resource_type === "image" && asset.type === "upload" && ["jpg", "png", "webp"].includes(String(asset.format)));
  for (const key of ["bytes", "width", "height"]) guard(Number.isSafeInteger(asset[key]) && Number(asset[key]) > 0 && image[key] === asset[key]);
  guard(Number(asset.bytes) <= 10485760 && image.format === asset.format && Number.isSafeInteger(asset.version) && Number(asset.version) > 0);
  const url = new URL(String(asset.secure_url));
  guard(url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password && !url.port && !url.search && !url.hash);
  guard(decodeURIComponent(url.pathname) === `/${cloud}/image/upload/v${asset.version}/${asset.public_id}.${asset.format}` && validProductImage(String(image.url)));
}
function imageFingerprint(images: Row[]) { return createHash("sha256").update(JSON.stringify(images)).digest("hex"); }
async function inspect(client: Client) {
  const rows = (await client.query('SELECT * FROM public."Product" WHERE id=$1 OR slug=$2 OR name=$3', [targetId, testProduct.slug, testProduct.name])).rows;
  guard(rows.length === 1); assertTarget(rows[0]);
  const images = (await client.query('SELECT * FROM public."ProductImage" WHERE "productId"=$1 ORDER BY id', [targetId])).rows;
  guard(images.length === 1 && images[0].isPrimary && images[0].imageType === "MULTI_VIEW");
  const variants = (await client.query('SELECT v.*,i.quantity,i.reserved,i."lowStockAt",c.name AS color,s.name AS size FROM public."ProductVariant" v LEFT JOIN public."Inventory" i ON i."variantId"=v.id LEFT JOIN public."Color" c ON c.id=v."colorId" LEFT JOIN public."Size" s ON s.id=v."sizeId" WHERE v."productId"=$1 ORDER BY v.sku', [targetId])).rows;
  guard(variants.length === 0 || variants.length === 3);
  return { product: rows[0], images, variants };
}
export function assertVariants(variants: Row[]) {
  guard(variants.length === 3);
  for (const expected of fixtures) {
    const row = variants.find(row => row.sku === `TEST-CART-DEV2-BLK-${expected.size}`);
    guard(row && row.productId === targetId && row.color === "Black" && row.size === expected.size && row.isActive === expected.isActive && row.priceOverride === 899000);
    inventoryValuesSchema.parse({ quantity: row.quantity, reserved: row.reserved, lowStockAt: row.lowStockAt });
    guard(row.quantity === expected.quantity && row.reserved === 0 && stockLimit({ quantity: Number(row.quantity), reserved: Number(row.reserved) }) === expected.quantity);
  }
}
async function reference(client: Client, table: "Color" | "Size", name: string, order = 0) {
  const slug = `test-cart-${name.toLowerCase()}-dev2`;
  const own = (await client.query(`SELECT * FROM public."${table}" WHERE slug=$1 FOR SHARE`, [slug])).rows[0];
  if (own) { guard(own.name === name && (table !== "Color" || own.hexCode === "#000000")); return own.id as string; }
  const existing = (await client.query(`SELECT * FROM public."${table}" WHERE name=$1 ORDER BY id FOR SHARE`, [name])).rows;
  const row = existing.find(row => table !== "Color" || row.hexCode?.toLowerCase() === "#000000");
  if (row) return row.id as string;
  const id = `test-cart-${randomUUID()}`;
  if (table === "Color") await client.query('INSERT INTO public."Color" (id,name,slug,"hexCode","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)', [id, name, slug, "#000000"]);
  else await client.query('INSERT INTO public."Size" (id,name,slug,"sortOrder","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)', [id, name, slug, order]);
  return id;
}
async function provision(client: Client) {
  const category = (await client.query('SELECT id FROM public."Category" WHERE "isActive"=true ORDER BY (slug=$1) DESC,id LIMIT 1 FOR SHARE', ["cargo-pants-test"])).rows[0];
  let categoryId = category?.id;
  if (!categoryId) {
    const slug = "test-cart-category-dev2";
    guard(!(await client.query('SELECT id FROM public."Category" WHERE slug=$1', [slug])).rowCount);
    categoryId = `test-cart-${randomUUID()}`;
    await client.query('INSERT INTO public."Category" (id,name,slug,"isActive","updatedAt") VALUES ($1,$2,$3,true,CURRENT_TIMESTAMP)', [categoryId, "Cart Integration TEST", slug]);
  }
  await client.query('INSERT INTO public."ProductCategory" ("productId","categoryId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [targetId, categoryId]);
  const colorId = await reference(client, "Color", "Black");
  for (const [index, fixture] of fixtures.entries()) {
    const sizeId = await reference(client, "Size", fixture.size, index + 1);
    const sku = `TEST-CART-DEV2-BLK-${fixture.size}`;
    const existing = (await client.query('SELECT * FROM public."ProductVariant" WHERE sku=$1', [sku])).rows[0];
    if (existing) { guard(existing.productId === targetId && existing.colorId === colorId && existing.sizeId === sizeId); continue; }
    const variantId = `test-cart-${randomUUID()}`;
    await client.query('INSERT INTO public."ProductVariant" (id,"productId",sku,"colorId","sizeId","priceOverride","isActive","updatedAt") VALUES ($1,$2,$3,$4,$5,899000,$6,CURRENT_TIMESTAMP)', [variantId, targetId, sku, colorId, sizeId, fixture.isActive]);
    await client.query('INSERT INTO public."Inventory" (id,"variantId",quantity,reserved,"lowStockAt","updatedAt") VALUES ($1,$2,$3,0,0,CURRENT_TIMESTAMP)', [`test-cart-${randomUUID()}`, variantId, fixture.quantity]);
  }
}
async function validateActivation(client: Client, ready: Awaited<ReturnType<typeof inspect>>) {
  const categories = (await client.query('SELECT "categoryId" FROM public."ProductCategory" WHERE "productId"=$1', [targetId])).rows;
  const collections = (await client.query('SELECT "collectionId" FROM public."ProductCollection" WHERE "productId"=$1', [targetId])).rows;
  const current = { ...ready.product, images: ready.images, categories, collections,
    variants: ready.variants.map(row => ({ ...row, inventory: { quantity: row.quantity, reserved: row.reserved, lowStockAt: row.lowStockAt } })) };
  // Execute the application's actual publish validator on this same PG transaction.
  const reader = (table: "Category" | "Collection" | "Color" | "Size") => ({ findMany: async (query: { where: { id: { in: string[] }; isActive?: boolean } }) => {
    const active = query.where.isActive === true ? ' AND "isActive"=true' : "";
    return (await client.query(`SELECT id FROM public."${table}" WHERE id=ANY($1::text[])${active}`, [query.where.id.in])).rows;
  } });
  const db = { category: reader("Category"), collection: reader("Collection"), color: reader("Color"), size: reader("Size"),
    $queryRaw: async (query: Prisma.Sql) => (await client.query(query.text, [...query.values])).rows };
  await validateProductUpdate(current as unknown as Parameters<typeof validateProductUpdate>[0], { id: targetId, status: "ACTIVE" }, db as unknown as Prisma.TransactionClient);
}
export async function main() {
  guard(process.argv.length === 3 && ["--check", "--apply"].includes(process.argv[2]));
  const env = { ...dotenv.parse(fs.readFileSync(".env")), ...process.env };
  guard(env.NODE_TLS_REJECT_UNAUTHORIZED !== "0");
  const url = new URL(env.KONO_MEDIA_DEV_DATABASE_URL ?? ""); url.searchParams.set("sslmode", "verify-full"); assertMediaDevelopmentUrl(url.toString());
  url.hostname = url.hostname.replace("-pooler.", "."); url.searchParams.set("options", "-c search_path=public");
  const response = await fetch("http://127.0.0.1:3001/api/media-dev/runtime", { signal: AbortSignal.timeout(15000) });
  const runtime = await response.json(); guard(response.ok && runtime.success); assertMediaDevelopmentIdentity(runtime.identity);
  const client = new Client({ connectionString: url.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 }); client.on("error", () => {});
  let committed = false;
  try {
    await client.connect(); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await verify(client, true);
    const before = await inspect(client); const protectedBefore = await sourceFingerprint(client);
    if (before.variants.length) assertVariants(before.variants);
    const conflicts = (await client.query('SELECT sku,"productId" FROM public."ProductVariant" WHERE sku=ANY($1::text[])', [fixtures.map(row => `TEST-CART-DEV2-BLK-${row.size}`)])).rows;
    guard(conflicts.every(row => row.productId === targetId));
    guard(/^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME ?? "") && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
    const image = before.images[0];
    const assetResponse = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload/${encodeURIComponent(String(image.cloudinaryPublicId))}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString("base64")}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    guard(assetResponse.ok); const asset = await assetResponse.json(); assertAsset(image, asset, env.CLOUDINARY_CLOUD_NAME!);
    const delivery = await fetch(String(image.url), { redirect: "error", signal: AbortSignal.timeout(15000) }); guard(delivery.ok && delivery.headers.get("content-type")?.startsWith("image/")); await delivery.body?.cancel();
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ stage: "read_only_preflight_passed", identity, image: { id: image.id, type: image.imageType, primary: image.isPrimary, bytes: image.bytes, width: image.width, height: image.height, format: image.format }, cloudinaryVerified: true }));
    if (process.argv[2] === "--check") return;
    await client.query("BEGIN"); await client.query("SET LOCAL lock_timeout='5s'"); await verify(client, false);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [testProduct.slug]);
    await client.query('SELECT id FROM public."Product" WHERE id=$1 FOR UPDATE', [targetId]);
    await client.query('SELECT id FROM public."Product" WHERE id=$1 FOR SHARE', [sourceId]);
    await client.query('SELECT id FROM public."ProductVariant" WHERE "productId"=$1 ORDER BY id FOR UPDATE', [targetId]);
    await client.query('SELECT id FROM public."ProductImage" WHERE "productId"=$1 ORDER BY id FOR SHARE', [targetId]);
    await client.query('SELECT i.id FROM public."Inventory" i JOIN public."ProductVariant" v ON i."variantId"=v.id WHERE v."productId"=$1 ORDER BY i.id FOR UPDATE OF i', [targetId]);
    const locked = await inspect(client); guard(imageFingerprint(locked.images) === imageFingerprint(before.images) && await sourceFingerprint(client) === protectedBefore);
    if (locked.variants.length) assertVariants(locked.variants);
    if (locked.product.status === "DRAFT") await provision(client);
    const ready = await inspect(client); assertVariants(ready.variants); assertAsset(ready.images[0], asset, env.CLOUDINARY_CLOUD_NAME!);
    await validateActivation(client, ready);
    const references = (await client.query('SELECT c."isActive" FROM public."ProductCategory" pc JOIN public."Category" c ON c.id=pc."categoryId" WHERE pc."productId"=$1 FOR SHARE OF c', [targetId])).rows;
    guard(references.length > 0 && references.every(row => row.isActive === true));
    guard(ready.variants.some(row => row.isActive && stockLimit({ quantity: Number(row.quantity), reserved: Number(row.reserved) }) > 0));
    if (ready.product.status === "DRAFT") guard((await client.query('UPDATE public."Product" SET status=$2,"publishedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status=$3', [targetId, "ACTIVE", "DRAFT"])).rowCount === 1);
    guard(await sourceFingerprint(client) === protectedBefore);
    await client.query("COMMIT"); committed = true;
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); await verify(client, true);
    const after = await inspect(client); assertVariants(after.variants);
    guard(after.product.status === "ACTIVE" && after.product.publishedAt && imageFingerprint(after.images) === imageFingerprint(before.images) && await sourceFingerprint(client) === protectedBefore);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ result: "active_test_read_only_verified", product: { id: targetId, name: after.product.name, status: after.product.status, price: after.product.basePrice }, variants: after.variants.map(row => ({ id: row.id, sku: row.sku, color: row.color, size: row.size, active: row.isActive, price: row.priceOverride, quantity: row.quantity, reserved: row.reserved, available: Number(row.quantity) - Number(row.reserved) })), imagePreserved: true, protectedProductUnchanged: true, pdp: `http://127.0.0.1:3001/products/${testProduct.slug}` }));
  } catch {
    console.error(committed ? "Committed; read-only follow-up failed. Inspect Development before retrying." : "Stopped; rollback requested. If interrupted around COMMIT, inspect Development before retrying.");
    throw new Error("TEST activation stopped.");
  } finally { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("TEST activation failed; raw details suppressed."); process.exitCode = 1; });
