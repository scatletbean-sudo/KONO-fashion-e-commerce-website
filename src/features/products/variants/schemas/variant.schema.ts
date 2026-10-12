import { z } from "zod";
import { inventoryValuesSchema } from "@/features/inventory/schemas/inventory-values.schema";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required");

const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required")
  .max(100, "SKU is too long");

const inventorySchema = inventoryValuesSchema;

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
  .omit({ productId: true, inventory: true })
  .partial()
  .extend({
    id: idSchema,
    isActive: z.boolean().optional(),
  })
  .strict()
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
