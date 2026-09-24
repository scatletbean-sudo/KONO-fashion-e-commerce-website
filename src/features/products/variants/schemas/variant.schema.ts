import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required")
  .max(100, "SKU is too long");

const inventorySchema = z.object({
  quantity: z
    .number()
    .int()
    .min(0, "Quantity cannot be negative")
    .default(0),

  reserved: z
    .number()
    .int()
    .min(0, "Reserved cannot be negative")
    .default(0),

  lowStockAt: z
    .number()
    .int()
    .min(0, "Low stock threshold cannot be negative")
    .default(5),
});

export const createVariantSchema = z.object({
  productId: idSchema,

  sku: skuSchema,

  colorId: idSchema.optional(),

  sizeId: idSchema.optional(),

  priceOverride: z
    .number()
    .int()
    .min(0, "Price override cannot be negative")
    .optional(),

  costPrice: z
    .number()
    .int()
    .min(0, "Cost price cannot be negative")
    .optional(),

  barcode: z
    .string()
    .trim()
    .max(100, "Barcode is too long")
    .optional(),

  isActive: z
    .boolean()
    .default(true),

  inventory: inventorySchema.optional(),
});

export const updateVariantSchema = createVariantSchema
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

export const variantIdSchema = z.object({
  id: idSchema,
});

export const variantSkuSchema = z.object({
  sku: skuSchema,
});

export const variantProductIdSchema = z.object({
  productId: idSchema,
});

export type CreateVariantInput = z.infer<
  typeof createVariantSchema
>;

export type UpdateVariantInput = z.infer<
  typeof updateVariantSchema
>;