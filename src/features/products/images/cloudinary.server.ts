import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MAX_IMAGE_BYTES, MediaError, validateImageFile } from "./media-policy";

type Config = { cloudName: string; apiKey: string; apiSecret: string };
function configuration(): Config {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) {
    throw new MediaError("Cloudinary is not configured on the server.", 503);
  }
  return { cloudName, apiKey, apiSecret };
}

// Cloudinary uses SHA(parameters + secret), not HMAC, for upload signatures.
export function signCloudinaryParameters(params: Record<string, string>, secret: string) {
  const serialized = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return createHash("sha256").update(serialized + secret).digest("hex");
}

const ticketSchema = z.object({ productId: z.string(), adminId: z.string(), publicId: z.string(), expiresAt: z.number().int() });
const ticketMac = (payload: string, secret: string) => createHmac("sha256", secret).update(`kono-media-v1:${payload}`).digest("hex");

export function createSignedUpload(productId: string, adminId: string, file: { size: number; type: string }, config = configuration(), now = Date.now()) {
  validateImageFile(file);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) throw new MediaError("Invalid product ID.");
  const publicId = `kono/products/${productId}/${randomUUID()}`;
  const timestamp = Math.floor(now / 1000);
  const params = { allowed_formats: "jpg,png,webp", overwrite: "false", public_id: publicId, timestamp: String(timestamp) };
  const payload = Buffer.from(JSON.stringify({ productId, adminId, publicId, expiresAt: timestamp + 3600 })).toString("base64url");
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    apiKey: config.apiKey, params, signature: signCloudinaryParameters(params, config.apiSecret),
    uploadToken: `${payload}.${ticketMac(payload, config.apiSecret)}`, publicId, maxBytes: MAX_IMAGE_BYTES,
  };
}

export function verifyUploadTicket(token: string, productId: string, adminId: string, publicId: string, secret = configuration().apiSecret, now = Date.now()) {
  if (token.length > 2048) throw new MediaError("Invalid upload authorization.");
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) throw new MediaError("Invalid upload authorization.");
  const expected = Buffer.from(ticketMac(parts[0], secret), "hex");
  if (!timingSafeEqual(expected, Buffer.from(parts[1], "hex"))) throw new MediaError("Invalid upload authorization.");
  let parsed: z.infer<typeof ticketSchema>;
  try { parsed = ticketSchema.parse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))); }
  catch { throw new MediaError("Invalid upload authorization."); }
  if (parsed.productId !== productId || parsed.adminId !== adminId || parsed.publicId !== publicId || parsed.expiresAt < Math.floor(now / 1000)) {
    throw new MediaError("Upload authorization expired or does not belong to this product and admin.");
  }
  if (!publicId.startsWith(`kono/products/${productId}/`)) throw new MediaError("Invalid upload authorization.");
}

const resourceSchema = z.object({
  public_id: z.string(), asset_id: z.string().min(1), resource_type: z.literal("image"), type: z.literal("upload"),
  format: z.enum(["jpg", "png", "webp"]), bytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
  width: z.number().int().positive(), height: z.number().int().positive(), version: z.number().int().positive(), secure_url: z.string().url(),
});

export function verifiedResourceData(value: unknown, publicId: string, cloudName: string) {
  const result = resourceSchema.safeParse(value);
  if (!result.success || result.data.public_id !== publicId) throw new MediaError("Cloudinary image failed verification: check format, size and resource identity.");
  const asset = result.data;
  const url = new URL(asset.secure_url);
  // Use the canonical original only: never accept a client URL or cropped transformation.
  const path = `/${cloudName}/image/upload/v${asset.version}/${publicId}.${asset.format}`;
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port || url.search || url.hash || decodeURIComponent(url.pathname) !== path) {
    throw new MediaError("Cloudinary image URL failed verification.");
  }
  return { url: asset.secure_url, cloudinaryPublicId: asset.public_id, cloudinaryAssetId: asset.asset_id,
    bytes: asset.bytes, width: asset.width, height: asset.height, format: asset.format };
}

export async function verifyCloudinaryResource(publicId: string, config = configuration(), fetcher: typeof fetch = fetch) {
  let response: Response;
  try {
    response = await fetcher(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new MediaError("Could not verify the image with Cloudinary. Try again.", 502); }
  if (!response.ok) throw new MediaError("Could not verify the image with Cloudinary. Try again.", 502);
  let value: unknown;
  try { value = await response.json(); } catch { throw new MediaError("Invalid response from Cloudinary.", 502); }
  return verifiedResourceData(value, publicId, config.cloudName);
}
