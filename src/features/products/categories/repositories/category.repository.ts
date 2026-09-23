import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

const categoryInclude = {
  parent: true,

  children: {
    orderBy: {
      name: "asc",
    },
  },

  products: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.CategoryInclude;

export const categoryRepository = {
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
    return prisma.category.create({
      data,
      include: categoryInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
  ) {
    return prisma.category.update({
      where: { id },
      data,
      include: categoryInclude,
    });
  },

  async delete(id: string) {
    return prisma.category.delete({
      where: { id },
    });
  },
};