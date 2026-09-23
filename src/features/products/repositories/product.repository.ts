import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const productInclude = {
  categories: {
    include: {
      category: true,
    },
  },

  collections: {
    include: {
      collection: true,
    },
  },

  images: {
    orderBy: {
      sortOrder: "asc",
    },
  },

  variants: {
    include: {
      color: true,
      size: true,
      inventory: true,
    },
  },
} satisfies Prisma.ProductInclude;

export const productRepository = {
  // ======================================================
  // GET ALL PRODUCTS
  // ======================================================

  async findAll() {
    return prisma.product.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: productInclude,
    });
  },

  // ======================================================
  // GET PRODUCT BY ID
  // ======================================================

  async findById(id: string) {
    return prisma.product.findUnique({
      where: {
        id,
      },
      include: productInclude,
    });
  },

  // ======================================================
  // GET PRODUCT BY SLUG
  // ======================================================

  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: {
        slug,
      },
      include: productInclude,
    });
  },

  // ======================================================
  // CREATE PRODUCT
  // ======================================================

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
      include: productInclude,
    });
  },

  // ======================================================
  // UPDATE PRODUCT
  // ======================================================

  async update(
    id: string,
    data: Prisma.ProductUpdateInput,
  ) {
    return prisma.product.update({
      where: {
        id,
      },
      data,
      include: productInclude,
    });
  },

  // ======================================================
  // DELETE PRODUCT
  // ======================================================

  async delete(id: string) {
    return prisma.product.delete({
      where: {
        id,
      },
    });
  },
};