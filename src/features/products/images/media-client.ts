import { z } from "zod";

export async function mediaRequest<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try { response = await fetcher(url, { ...init, credentials: "same-origin", cache: "no-store" }); }
  catch { throw new Error("Could not connect. Try again."); }
  let body;
  try { body = await response.json(); } catch { throw new Error("Unexpected server response. Reload and try again."); }
  if (!response.ok || body?.success !== true) {
    if (response.status === 401) throw new Error("Your admin session expired. Sign in again.");
    // Media routes return only explicitly safe errors; never display Cloudinary's raw response.
    throw new Error(typeof body?.message === "string" ? body.message : "Could not save media. Try again.");
  }
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) throw new Error("Unexpected server response. Reload and try again.");
  return parsed.data;
}

export const signedUploadSchema = z.object({
  uploadUrl: z.string().url(), apiKey: z.string(), params: z.record(z.string(), z.string()),
  signature: z.string(), uploadToken: z.string(), publicId: z.string(), maxBytes: z.number(),
});
export type SignedUpload = z.infer<typeof signedUploadSchema>;

export async function uploadImageDirect(file: File, signed: SignedUpload, fetcher: typeof fetch = fetch) {
  const url = new URL(signed.uploadUrl);
  if (url.protocol !== "https:" || url.hostname !== "api.cloudinary.com" || !/^\/v1_1\/[a-zA-Z0-9_-]+\/image\/upload$/.test(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid upload destination.");
  }
  const body = new FormData();
  for (const [name, value] of Object.entries(signed.params)) body.append(name, value);
  body.append("api_key", signed.apiKey); body.append("signature", signed.signature); body.append("file", file);
  let response: Response;
  try { response = await fetcher(url.toString(), { method: "POST", body, credentials: "omit", signal: AbortSignal.timeout(120000) }); }
  catch { throw new Error("Upload could not finish. Check your connection and try again."); }
  if (!response.ok) throw new Error("Cloudinary rejected the upload. Check the image format and size.");
  // Resource metadata and URL are fetched independently on the server before attachment.
}

// Reuse the exact destination/signature/form validation above; XHR adds real byte progress.
export async function uploadImageWithProgress(file: File, signed: SignedUpload, onProgress: (percent: number) => void) {
  const transfer: typeof fetch = (input, init) => new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", String(input));
    xhr.withCredentials = false;
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status <= 599) resolve(new Response(null, { status: xhr.status }));
      else reject(new Error("Transfer failed"));
    };
    xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error("Transfer failed"));
    xhr.send(init?.body as FormData);
  });
  await uploadImageDirect(file, signed, transfer);
}
