import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteUnusedAttribute } from "../../attributes/guarded-delete";
import { writeWithUniqueAttributeName } from "../../attributes/unique-name-write";

const collectionInclude = {
  products: {
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          variants: { include: { color: true, size: true, inventory: true } },
        },
      },
    },
  },
} satisfies Prisma.CollectionInclude;

export const collectionRepository = {
  async findByName(name: string, excludeId?: string) {
    return prisma.collection.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  },
  async findAll() {
    return prisma.collection.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: collectionInclude,
    });
  },

  async findById(id: string) {
    return prisma.collection.findUnique({
      where: { id },
      include: collectionInclude,
    });
  },

  async findBySlug(slug: string) {
    return prisma.collection.findUnique({
      where: { slug },
      include: collectionInclude,
    });
  },

  async create(data: Prisma.CollectionCreateInput) {
    return writeWithUniqueAttributeName("collection", data.name, undefined, tx => tx.collection.create({
      data,
      include: collectionInclude,
    }));
  },

  async update(
    id: string,
    data: Prisma.CollectionUpdateInput,
  ) {
    return writeWithUniqueAttributeName("collection", data.name, id, tx => tx.collection.update({
      where: { id },
      data,
      include: collectionInclude,
    }));
  },

  async delete(id: string) {
    return deleteUnusedAttribute("collection", id);
  },
};
