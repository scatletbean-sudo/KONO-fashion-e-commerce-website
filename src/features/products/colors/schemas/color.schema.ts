import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(100, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers and hyphens",
  );

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

export const createColorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Color name is required")
    .max(100, "Color name is too long"),

  slug: slugSchema,

  hexCode: z
    .string()
    .trim()
    .regex(
      /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/,
      "Invalid hex color code",
    )
    .optional(),
});

export const updateColorSchema = createColorSchema
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

export const colorIdSchema = z.object({
  id: idSchema,
});

export const colorSlugSchema = z.object({
  slug: slugSchema,
});

export type CreateColorInput = z.infer<
  typeof createColorSchema
>;

export type UpdateColorInput = z.infer<
  typeof updateColorSchema
>;