import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const colorInclude = {
  variants: {
    include: {
      product: true,
      size: true,
      inventory: true,
    },
  },
} satisfies Prisma.ColorInclude;

export const colorRepository = {
  async findAll() {
    return prisma.color.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: colorInclude,
    });
  },

  async findById(id: string) {
    return prisma.color.findUnique({
      where: { id },
      include: colorInclude,
    });
  },

  async findBySlug(slug: string) {
    return prisma.color.findUnique({
      where: { slug },
      include: colorInclude,
    });
  },

  async create(data: Prisma.ColorCreateInput) {
    return prisma.color.create({
      data,
      include: colorInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.ColorUpdateInput,
  ) {
    return prisma.color.update({
      where: { id },
      data,
      include: colorInclude,
    });
  },

  async delete(id: string) {
    return prisma.color.delete({
      where: { id },
    });
  },
};