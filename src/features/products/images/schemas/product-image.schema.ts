import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

export const createProductImageSchema = z.object({
  productId: idSchema,

  url: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .max(2000, "Image URL is too long"),

  alt: z
    .string()
    .trim()
    .max(255, "Alt text is too long")
    .optional(),

  sortOrder: z
    .number()
    .int()
    .min(0)
    .default(0),

  isPrimary: z
    .boolean()
    .default(false),
});

export const updateProductImageSchema =
  createProductImageSchema
    .omit({
      productId: true,
    })
    .partial()
    .extend({
      id: idSchema,
    })
    .refine(
      (data) => Object.keys(data).length > 1,
      {
        message: "At least one field must be updated",
      },
    );

export const productImageIdSchema = z.object({
  id: idSchema,
});

export const productImageProductIdSchema = z.object({
  productId: idSchema,
});

export type CreateProductImageInput = z.infer<
  typeof createProductImageSchema
>;

export type UpdateProductImageInput = z.infer<
  typeof updateProductImageSchema
>;