import { z } from "zod";
import { inventoryValuesSchema } from "./inventory-values.schema";

const variantIdSchema = z
  .string()
  .trim()
  .min(1, "Variant ID is required");

export const inventoryVariantIdSchema = z.object({
  variantId: variantIdSchema,
});

export const createInventorySchema = inventoryValuesSchema.safeExtend({
  variantId: variantIdSchema,
});

export const updateInventorySchema = z
  .object({
    quantity: inventoryValuesSchema.shape.quantity.unwrap().optional(),

    reserved: inventoryValuesSchema.shape.reserved.unwrap().optional(),

    lowStockAt: inventoryValuesSchema.shape.lowStockAt.unwrap().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be updated",
    },
  );

export type CreateInventoryInput = z.infer<
  typeof createInventorySchema
>;

export type UpdateInventoryInput = z.infer<
  typeof updateInventorySchema
>;