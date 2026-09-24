import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const productImageInclude = {
  product: true,
} satisfies Prisma.ProductImageInclude;

export const productImageRepository = {
  async findAll() {
    return prisma.productImage.findMany({
      orderBy: [
        {
          productId: "asc",
        },
        {
          sortOrder: "asc",
        },
      ],
      include: productImageInclude,
    });
  },

  async findById(id: string) {
    return prisma.productImage.findUnique({
      where: { id },
      include: productImageInclude,
    });
  },

  async findByProductId(productId: string) {
    return prisma.productImage.findMany({
      where: {
        productId,
      },
      orderBy: {
        sortOrder: "asc",
      },
      include: productImageInclude,
    });
  },

  async unsetPrimaryByProductId(productId: string) {
    return prisma.productImage.updateMany({
      where: {
        productId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });
  },

  async create(data: Prisma.ProductImageCreateInput) {
    return prisma.productImage.create({
      data,
      include: productImageInclude,
    });
  },

  async update(
    id: string,
    data: Prisma.ProductImageUpdateInput,
  ) {
    return prisma.productImage.update({
      where: { id },
      data,
      include: productImageInclude,
    });
  },

  async delete(id: string) {
    return prisma.productImage.delete({
      where: { id },
    });
  },
};