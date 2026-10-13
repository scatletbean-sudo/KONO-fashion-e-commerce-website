import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { deleteUnusedAttribute } from "../../attributes/guarded-delete";
import { writeWithUniqueAttributeName } from "../../attributes/unique-name-write";

const categoryInclude = {
  parent: true,

  children: {
    orderBy: {
      name: "asc",
    },
  },

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
} satisfies Prisma.CategoryInclude;

export const categoryRepository = {
  async findByName(name: string, excludeId?: string) {
    return prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  },
  async findAll() {
    return prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      include: categoryInclude,
    });
  },

  async findById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });
  },

  async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: categoryInclude,
    });
  },

  async create(data: Prisma.CategoryCreateInput) {
    return writeWithUniqueAttributeName("category", data.name, undefined, tx => tx.category.create({
      data,
      include: categoryInclude,
    }));
  },

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
  ) {
    return writeWithUniqueAttributeName("category", data.name, id, tx => tx.category.update({
      where: { id },
      data,
      include: categoryInclude,
    }));
  },

  async delete(id: string) {
    return deleteUnusedAttribute("category", id);
  },
};
