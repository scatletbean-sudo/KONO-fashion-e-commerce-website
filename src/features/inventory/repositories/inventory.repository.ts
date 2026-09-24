import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

const inventoryInclude = {
  variant: {
    include: {
      product: true,
      color: true,
      size: true,
    },
  },
} satisfies Prisma.InventoryInclude;

export const inventoryRepository = {
  async findAll() {
    return prisma.inventory.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: inventoryInclude,
    });
  },

  async findById(id: string) {
    return prisma.inventory.findUnique({
      where: { id },
      include: inventoryInclude,
    });
  },

  async findByVariantId(variantId: string) {
    return prisma.inventory.findUnique({
      where: {
        variantId,
      },
      include: inventoryInclude,
    });
  },

  async create(
    data: Prisma.InventoryCreateInput,
  ) {
    return prisma.inventory.create({
      data,
      include: inventoryInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.InventoryUpdateInput,
  ) {
    return prisma.inventory.update({
      where: { id },
      data,
      include: inventoryInclude,
    });
  },

  async delete(id: string) {
    return prisma.inventory.delete({
      where: { id },
    });
  },
};