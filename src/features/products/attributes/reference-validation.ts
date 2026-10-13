import { Prisma } from "@/generated/prisma/client";
import type { CreateProductInput } from "../schemas/product.schema";
import { AttributeReferenceError } from "./attribute-errors";

export async function validateAttributeReferences(data: Pick<CreateProductInput, "categoryIds" | "collectionIds" | "variants">, db: Prisma.TransactionClient, lock = false) {
  for (const [field, label] of [
    ["categoryIds", "Category"], ["collectionIds", "Collection"],
  ] as const) {
    const ids = [...new Set(data[field])];
    if (!ids.length) continue;
    if (lock) await db.$queryRaw(field === "categoryIds"
      ? Prisma.sql`SELECT id FROM "Category" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`
      : Prisma.sql`SELECT id FROM "Collection" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
    const query = { where: { id: { in: ids }, isActive: true }, select: { id: true } } as const;
    const records = field === "categoryIds" ? await db.category.findMany(query) : await db.collection.findMany(query);
    if (records.length !== ids.length) throw new AttributeReferenceError(field, `${label} selection contains an unavailable or inactive ID. Choose an active attribute.`);
  }
  for (const [field, label] of [
    ["colorId", "Color"], ["sizeId", "Size"],
  ] as const) {
    const ids = [...new Set(data.variants.flatMap(variant => variant[field] ? [variant[field]!] : []))];
    if (!ids.length) continue;
    if (lock) await db.$queryRaw(field === "colorId"
      ? Prisma.sql`SELECT id FROM "Color" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`
      : Prisma.sql`SELECT id FROM "Size" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
    // Color and Size currently have no isActive field in the Prisma model.
    const query = { where: { id: { in: ids } }, select: { id: true } } as const;
    const records = field === "colorId" ? await db.color.findMany(query) : await db.size.findMany(query);
    if (records.length !== ids.length) throw new AttributeReferenceError("variants", `${label} selection contains an unavailable ID. Choose an existing attribute.`);
  }
}
