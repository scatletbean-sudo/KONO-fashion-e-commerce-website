import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MediaError } from "../media-policy";

const productImageInclude = {
  product: true,
} satisfies Prisma.ProductImageInclude;

export const productImageRepository = {
  async transaction<T>(productId: string, callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`);
      if (!rows.length) throw new MediaError("Product not found", 404);
      return callback(tx);
    });
  },
  async productExists(productId: string) {
    return !!(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }));
  },
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
