import { z } from "zod";
export const cartQuantityLimit = 99;
export const cartInput = z.object({ variantId: z.string().min(1).max(128), quantity: z.number().int().min(0).max(cartQuantityLimit) }).strict();
export const availabilitySchema = z.object({ variantId: z.string(), price: z.number().int().positive(), maxQuantity: z.number().int().min(0).max(cartQuantityLimit), currentQuantity: z.number().int().min(0), inStock: z.boolean(), lowStock: z.boolean().optional() });
export type Availability = z.infer<typeof availabilitySchema>;
export const cartSchema = z.object({ items: z.array(z.object({ variantId: z.string(), productId: z.string(), name: z.string(), slug: z.string(), imageUrl: z.string().nullable().optional(), color: z.string().nullable(), size: z.string().nullable(), quantity: z.number().int().positive(), price: z.number().int().positive(), maxQuantity: z.number().int().nonnegative() })) });
export type CartSnapshot = z.infer<typeof cartSchema>;
export class CartError extends Error { constructor(message: string, public readonly status = 400) { super(message); } }
export function stockLimit(inventory: { quantity: number; reserved: number } | null) {
  if (!inventory || !Number.isSafeInteger(inventory.quantity) || !Number.isSafeInteger(inventory.reserved) || inventory.quantity < 0 || inventory.reserved < 0 || inventory.reserved > inventory.quantity) return 0;
  return Math.min(cartQuantityLimit, inventory.quantity - inventory.reserved);
}
