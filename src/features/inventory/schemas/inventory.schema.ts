import { z } from "zod";

const variantIdSchema = z
  .string()
  .trim()
  .min(1, "Variant ID is required");

const quantitySchema = z
  .number()
  .int()
  .min(0, "Quantity cannot be negative");

const reservedSchema = z
  .number()
  .int()
  .min(0, "Reserved quantity cannot be negative");

const lowStockAtSchema = z
  .number()
  .int()
  .min(0, "Low stock threshold cannot be negative");

export const inventoryVariantIdSchema = z.object({
  variantId: variantIdSchema,
});

export const createInventorySchema = z.object({
  variantId: variantIdSchema,

  quantity: quantitySchema.default(0),

  reserved: reservedSchema.default(0),

  lowStockAt: lowStockAtSchema.default(5),
});

export const updateInventorySchema = z
  .object({
    quantity: quantitySchema.optional(),

    reserved: reservedSchema.optional(),

    lowStockAt: lowStockAtSchema.optional(),
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