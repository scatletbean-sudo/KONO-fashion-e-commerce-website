import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");

export const dateRangeSchema = z
  .object({
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

export type DateRange = z.infer<typeof dateRangeSchema>;