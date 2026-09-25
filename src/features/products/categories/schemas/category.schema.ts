import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(200, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers and hyphens",
  );

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(255, "Category name is too long"),

  slug: slugSchema,

  description: z
    .string()
    .trim()
    .max(1000, "Description is too long")
    .optional(),

  imageUrl: z
    .string()
    .trim()
    .min(1, "Image URL cannot be empty")
    .optional(),

  parentId: idSchema.nullable().optional(),

  isActive: z
    .boolean()
    .default(true),
});

export const updateCategorySchema = createCategorySchema
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

export const categoryIdSchema = z.object({
  id: idSchema,
});

export const categorySlugSchema = z.object({
  slug: slugSchema,
});

export type CreateCategoryInput = z.infer<
  typeof createCategorySchema
>;

export type UpdateCategoryInput = z.infer<
  typeof updateCategorySchema
>;