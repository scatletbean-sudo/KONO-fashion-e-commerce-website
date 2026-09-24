import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(100, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers and hyphens",
  );

export const createSizeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Size name is required")
    .max(50, "Size name is too long"),

  slug: slugSchema,

  sortOrder: z
    .number()
    .int()
    .min(0)
    .default(0),
});

export const updateSizeSchema = createSizeSchema
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

export const sizeIdSchema = z.object({
  id: idSchema,
});

export const sizeSlugSchema = z.object({
  slug: slugSchema,
});

export type CreateSizeInput = z.infer<
  typeof createSizeSchema
>;

export type UpdateSizeInput = z.infer<
  typeof updateSizeSchema
>;