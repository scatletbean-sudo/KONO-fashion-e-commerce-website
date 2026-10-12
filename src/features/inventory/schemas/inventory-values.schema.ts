import { z } from "zod";

export const inventoryValuesSchema = z.object({
  quantity: z.number().int().min(0).default(0),
  reserved: z.number().int().min(0).default(0),
  lowStockAt: z.number().int().min(0).default(5),
}).refine((data) => data.reserved <= data.quantity, {
  message: "Reserved quantity cannot be greater than quantity",
  path: ["reserved"],
});

export function validateInventoryValues(values: unknown) {
  return inventoryValuesSchema.parse(values);
}
