import { z } from "zod";

export function createSortSchema<const T extends readonly string[]>(
  fields: T,
) {
  return z.object({
    sortBy: z.enum(fields).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });
}