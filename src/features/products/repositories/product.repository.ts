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

// ======================================================
// DATABASE CLIENT
// ======================================================

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => {
  return db ?? prisma;
};

// ======================================================
// PRODUCT REPOSITORY
// ======================================================

export const productRepository = {
  // ======================================================
  // TRANSACTION
  // ======================================================

  async transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return prisma.$transaction(callback);
  },

  // ======================================================
  // GET ALL PRODUCTS
  // ======================================================

  async findAll(db?: DbClient) {
    return getDb(db).product.findMany({
      orderBy: {
        createdAt: "desc",
      },

      include: productInclude,
    });
  },

  // ======================================================
  // GET PRODUCT BY ID
  // ======================================================

  async findById(
    id: string,
    db?: DbClient,
  ) {
    return getDb(db).product.findUnique({
      where: {
        id,
      },

      include: productInclude,
    });
  },

  // ======================================================
  // GET PRODUCT BY SLUG
  // ======================================================

  async findBySlug(
    slug: string,
    db?: DbClient,
  ) {
    return getDb(db).product.findUnique({
      where: {
        slug,
      },

      include: productInclude,
    });
  },

  // ======================================================
  // CREATE PRODUCT
  // ======================================================

  async create(
    data: Prisma.ProductCreateInput,
    db?: DbClient,
  ) {
    return getDb(db).product.create({
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
    db?: DbClient,
  ) {
    return getDb(db).product.update({
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

  async delete(
    id: string,
    db?: DbClient,
  ) {
    return getDb(db).product.delete({
      where: {
        id,
      },
    });
  },
};