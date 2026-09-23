import { prisma } from "@/lib/db/prisma";

export const productRepository = {
  async findAll() {
    return prisma.product.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
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
      },
    });
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: {
        id,
      },
      include: {
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
      },
    });
  },

  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: {
        slug,
      },
      include: {
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
      },
    });
  },
};