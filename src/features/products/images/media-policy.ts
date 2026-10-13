import { z } from "zod";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 24;
export const imageTypes = ["FRONT_VIEW", "BACK_VIEW", "LEFT_VIEW", "RIGHT_VIEW", "DETAIL", "ON_MODEL", "MULTI_VIEW", "SIZE_CHART", "PRODUCT", "LIFESTYLE"] as const;
export const imageTypeSchema = z.enum(imageTypes);
export const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export class MediaError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function validateImageFile(file: { size: number; type: string }) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new MediaError("Each image must be between 1 byte and 10 MB.");
  }
  if (!(imageMimeTypes as readonly string[]).includes(file.type)) {
    throw new MediaError("Only JPG, PNG and WebP images are supported.");
  }
}

export const mediaImageSchema = z.object({
  id: z.string(), productId: z.string(), url: z.string(), alt: z.string().nullable(),
  sortOrder: z.number().int(), isPrimary: z.boolean(), imageType: imageTypeSchema.default("PRODUCT"),
  cloudinaryPublicId: z.string().nullable().optional(), cloudinaryAssetId: z.string().nullable().optional(),
  width: z.number().nullable().optional(), height: z.number().nullable().optional(),
  bytes: z.number().nullable().optional(), format: z.string().nullable().optional(),
});
export type MediaImage = z.infer<typeof mediaImageSchema>;

export function validateGalleryOrder(ids: string[], existingIds: string[]) {
  if (ids.length !== existingIds.length || new Set(ids).size !== ids.length || ids.some(id => !existingIds.includes(id))) {
    throw new MediaError("The gallery changed. Reload before reordering.", 409);
  }
}

export function rejectInlineImages(images: unknown[] | undefined, editing = false) {
  if (editing ? images !== undefined : !!images?.length) {
    throw new MediaError("Save the product first, then manage images in Media Manager.");
  }
}
