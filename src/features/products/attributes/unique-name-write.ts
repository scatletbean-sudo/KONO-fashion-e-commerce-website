import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

// Names have no database unique constraint. Serialize management writes for the
// same name and recheck inside the transaction rather than relying on the UI.
export async function writeWithUniqueAttributeName<T>(
  resource: "category" | "collection" | "color" | "size", name: unknown, id: string | undefined,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async tx => {
    if (typeof name === "string") {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${resource} || ':' || lower(btrim(${name})), 0))::text`);
      const query = { where: { name: { equals: name.trim(), mode: "insensitive" as const }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } } as const;
      const existing = resource === "category" ? await tx.category.findFirst(query)
        : resource === "collection" ? await tx.collection.findFirst(query)
        : resource === "color" ? await tx.color.findFirst(query) : await tx.size.findFirst(query);
      if (existing) throw new Error(`${resource[0].toUpperCase() + resource.slice(1)} name already exists`);
    }
    return write(tx);
  });
}
