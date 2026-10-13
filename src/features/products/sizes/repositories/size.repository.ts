import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { deleteUnusedAttribute } from "../../attributes/guarded-delete";
import { writeWithUniqueAttributeName } from "../../attributes/unique-name-write";

const sizeInclude = {
  variants: true,
} satisfies Prisma.SizeInclude;

export const sizeRepository = {
  async findByName(name: string, excludeId?: string) {
    return prisma.size.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  },
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
    return writeWithUniqueAttributeName("size", data.name, undefined, tx => tx.size.create({
      data,
      include: sizeInclude,
    }));
  },

  async update(
    id: string,
    data: Prisma.SizeUpdateInput,
  ) {
    return writeWithUniqueAttributeName("size", data.name, id, tx => tx.size.update({
      where: { id },
      data,
      include: sizeInclude,
    }));
  },

  async delete(id: string) {
    return deleteUnusedAttribute("size", id);
  },
};
