import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

// Lock the referenced row before checking usage. Concurrent FK inserts must wait.
export async function deleteUnusedAttribute(resource: "category" | "collection" | "color" | "size", id: string) {
  return prisma.$transaction(async tx => {
    switch (resource) {
      case "category": {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Category" WHERE id = ${id} FOR UPDATE`);
        const item = await tx.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
        if (!item) throw new Error("Category not found");
        if (item._count.products || item._count.children) throw new Error("Category is in use by products or child categories. Deactivate it instead.");
        return tx.category.delete({ where: { id } });
      }
      case "collection": {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Collection" WHERE id = ${id} FOR UPDATE`);
        const item = await tx.collection.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
        if (!item) throw new Error("Collection not found");
        if (item._count.products) throw new Error("Collection is in use by products. Deactivate it instead.");
        return tx.collection.delete({ where: { id } });
      }
      case "color": {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Color" WHERE id = ${id} FOR UPDATE`);
        const item = await tx.color.findUnique({ where: { id }, include: { _count: { select: { variants: true } } } });
        if (!item) throw new Error("Color not found");
        if (item._count.variants) throw new Error("Color is in use by variants and cannot be deleted.");
        return tx.color.delete({ where: { id } });
      }
      case "size": {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Size" WHERE id = ${id} FOR UPDATE`);
        const item = await tx.size.findUnique({ where: { id }, include: { _count: { select: { variants: true } } } });
        if (!item) throw new Error("Size not found");
        if (item._count.variants) throw new Error("Size is in use by variants and cannot be deleted.");
        return tx.size.delete({ where: { id } });
      }
    }
  });
}
