import { z } from "zod";

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

const orderSortFields = [
  "createdAt",
  "orderNumber",
  "totalAmount",
] as const;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");

export const orderListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    sortBy: z.enum(orderSortFields).default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),

    status: z.enum(orderStatuses).optional(),

    search: z.string().trim().max(255).optional(),

    dateFrom: dateSchema.optional(),

    dateTo: dateSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.dateFrom || !data.dateTo) {
        return true;
      }

      return data.dateFrom <= data.dateTo;
    },
    {
      message: "dateFrom must be before or equal to dateTo",
      path: ["dateFrom"],
    },
  );

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;