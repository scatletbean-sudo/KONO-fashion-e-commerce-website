import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(200, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers and hyphens",
  );

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

export const createCollectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Collection name is required")
    .max(255, "Collection name is too long"),

  slug: slugSchema,

  description: z
    .string()
    .trim()
    .optional(),

  imageUrl: z
    .string()
    .trim()
    .url("Invalid image URL")
    .optional(),

  isFeatured: z
    .boolean()
    .default(false),

  isActive: z
    .boolean()
    .default(true),
});

export const updateCollectionSchema = createCollectionSchema
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

export const collectionIdSchema = z.object({
  id: idSchema,
});

export const collectionSlugSchema = z.object({
  slug: slugSchema,
});

export type CreateCollectionInput = z.infer<
  typeof createCollectionSchema
>;

export type UpdateCollectionInput = z.infer<
  typeof updateCollectionSchema
>;