import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const variantInclude = {
  product: true,

  color: true,

  size: true,

  inventory: true,
} satisfies Prisma.ProductVariantInclude;

export const variantRepository = {
  async findAll() {
    return prisma.productVariant.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: variantInclude,
    });
  },

  async findById(id: string) {
    return prisma.productVariant.findUnique({
      where: { id },
      include: variantInclude,
    });
  },

  async findBySku(sku: string) {
    return prisma.productVariant.findUnique({
      where: { sku },
      include: variantInclude,
    });
  },

  async findByProductId(productId: string) {
    return prisma.productVariant.findMany({
      where: {
        productId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: variantInclude,
    });
  },

  async create(data: Prisma.ProductVariantCreateInput) {
    return prisma.productVariant.create({
      data,
      include: variantInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.ProductVariantUpdateInput,
  ) {
    return prisma.productVariant.update({
      where: { id },
      data,
      include: variantInclude,
    });
  },

  async delete(id: string) {
    return prisma.productVariant.delete({
      where: { id },
    });
  },
};