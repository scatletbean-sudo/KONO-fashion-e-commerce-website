import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteUnusedAttribute } from "../../attributes/guarded-delete";
import { writeWithUniqueAttributeName } from "../../attributes/unique-name-write";

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
  async findByName(name: string, excludeId?: string) {
    return prisma.color.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  },
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
    return writeWithUniqueAttributeName("color", data.name, undefined, tx => tx.color.create({
      data,
      include: colorInclude,
    }));
  },

  async update(
    id: string,
    data: Prisma.ColorUpdateInput,
  ) {
    return writeWithUniqueAttributeName("color", data.name, id, tx => tx.color.update({
      where: { id },
      data,
      include: colorInclude,
    }));
  },

  async delete(id: string) {
    return deleteUnusedAttribute("color", id);
  },
};
