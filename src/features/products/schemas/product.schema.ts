import { z } from "zod";

// ======================================================
// COMMON
// ======================================================

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

// ======================================================
// PRODUCT IMAGE
// ======================================================

export const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Image URL is required"),

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

// ======================================================
// PRODUCT VARIANT
// ======================================================

export const productVariantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(100, "SKU is too long"),

  colorId: idSchema.optional(),

  sizeId: idSchema.optional(),

  priceOverride: z
    .number()
    .int()
    .min(0)
    .optional(),

  costPrice: z
    .number()
    .int()
    .min(0)
    .optional(),

  barcode: z
    .string()
    .trim()
    .max(100, "Barcode is too long")
    .optional(),

  isActive: z
    .boolean()
    .default(true),

  inventory: z
    .object({
      quantity: z
        .number()
        .int()
        .min(0)
        .default(0),

      reserved: z
        .number()
        .int()
        .min(0)
        .default(0),

      lowStockAt: z
        .number()
        .int()
        .min(0)
        .default(5),
    })
    .optional(),
});

// ======================================================
// UPDATE PRODUCT VARIANT
// ======================================================

export const updateProductVariantSchema =
  productVariantSchema.extend({
    id: idSchema.optional(),
  });

// ======================================================
// CREATE PRODUCT
// ======================================================

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(255, "Product name is too long"),

  slug: slugSchema,

  description: z
    .string()
    .trim()
    .optional(),

  shortDescription: z
    .string()
    .trim()
    .max(500, "Short description is too long")
    .optional(),

  status: z
    .enum(["DRAFT", "ACTIVE", "ARCHIVED"])
    .default("DRAFT"),

  basePrice: z
    .number()
    .int()
    .min(0, "Base price cannot be negative"),

  compareAtPrice: z
    .number()
    .int()
    .min(0)
    .optional(),

  brand: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .default("KONO"),

  metaTitle: z
    .string()
    .trim()
    .max(255)
    .optional(),

  metaDescription: z
    .string()
    .trim()
    .max(500)
    .optional(),

  // ----------------------------------------------------
  // RELATIONS
  // ----------------------------------------------------

  categoryIds: z
    .array(idSchema)
    .default([]),

  collectionIds: z
    .array(idSchema)
    .default([]),

  // ----------------------------------------------------
  // IMAGES
  // ----------------------------------------------------

  images: z
    .array(productImageSchema)
    .default([]),

  // ----------------------------------------------------
  // VARIANTS
  // ----------------------------------------------------

  variants: z
    .array(productVariantSchema)
    .default([]),
});

// ======================================================
// UPDATE PRODUCT
// ======================================================

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    id: idSchema,

    // --------------------------------------------------
    // RELATIONS
    // --------------------------------------------------

    categoryIds: z
      .array(idSchema)
      .optional(),

    collectionIds: z
      .array(idSchema)
      .optional(),

    // --------------------------------------------------
    // IMAGES
    // --------------------------------------------------

    images: z
      .array(productImageSchema)
      .optional(),

    // --------------------------------------------------
    // VARIANTS
    // --------------------------------------------------

    variants: z
      .array(updateProductVariantSchema)
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 1,
    {
      message: "At least one field must be updated",
    },
  );

// ======================================================
// PRODUCT ID
// ======================================================

export const productIdSchema = z.object({
  id: idSchema,
});

// ======================================================
// PRODUCT SLUG
// ======================================================

export const productSlugSchema = z.object({
  slug: slugSchema,
});

// ======================================================
// TYPES
// ======================================================

export type CreateProductInput = z.infer<
  typeof createProductSchema
>;

export type UpdateProductInput = z.infer<
  typeof updateProductSchema
>;

export type ProductImageInput = z.infer<
  typeof productImageSchema
>;

export type ProductVariantInput = z.infer<
  typeof productVariantSchema
>;