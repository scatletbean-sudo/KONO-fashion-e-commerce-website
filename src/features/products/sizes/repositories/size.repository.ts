import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

const sizeInclude = {
  variants: true,
} satisfies Prisma.SizeInclude;

export const sizeRepository = {
  async findAll() {
    return prisma.size.findMany({
      orderBy: {
        sortOrder: "asc",
      },
      include: sizeInclude,
    });
  },

  async findById(id: string) {
    return prisma.size.findUnique({
      where: { id },
      include: sizeInclude,
    });
  },

  async findBySlug(slug: string) {
    return prisma.size.findUnique({
      where: { slug },
      include: sizeInclude,
    });
  },

  async create(data: Prisma.SizeCreateInput) {
    return prisma.size.create({
      data,
      include: sizeInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.SizeUpdateInput,
  ) {
    return prisma.size.update({
      where: { id },
      data,
      include: sizeInclude,
    });
  },

  async delete(id: string) {
    return prisma.size.delete({
      where: { id },
    });
  },
};