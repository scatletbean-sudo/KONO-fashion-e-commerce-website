import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const collectionInclude = {
  products: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.CollectionInclude;

export const collectionRepository = {
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
    return prisma.collection.create({
      data,
      include: collectionInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.CollectionUpdateInput,
  ) {
    return prisma.collection.update({
      where: { id },
      data,
      include: collectionInclude,
    });
  },

  async delete(id: string) {
    return prisma.collection.delete({
      where: { id },
    });
  },
};