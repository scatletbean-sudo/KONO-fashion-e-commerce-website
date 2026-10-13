import { z } from "zod";
import { imageTypeSchema } from "../media-policy";

const idSchema = z.string().trim().min(1).max(128);
const metadata = z.object({
  alt: z.string().trim().max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
  imageType: imageTypeSchema.optional(),
});
export const createProductImageSchema = metadata.extend({
  productId: idSchema, publicId: z.string().min(1).max(255), uploadToken: z.string().min(1).max(2048),
}).strict();
export const updateProductImageSchema = metadata.extend({ id: idSchema }).strict()
  .refine(data => Object.keys(data).length > 1, "At least one field must be updated");
export const productImageIdSchema = z.object({ id: idSchema });
export const productImageProductIdSchema = z.object({ productId: idSchema });
export const signProductImageSchema = z.object({
  productId: idSchema, size: z.number().int().positive(), type: z.string().max(64),
}).strict();
export const reorderProductImagesSchema = z.object({ ids: z.array(idSchema).min(1).max(500) }).strict();
export type CreateProductImageInput = z.infer<typeof createProductImageSchema>;
export type UpdateProductImageInput = z.infer<typeof updateProductImageSchema>;
