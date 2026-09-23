import { Prisma } from "@/generated/prisma/client";

import { productRepository } from "../repositories/product.repository";

import type {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";

export const productService = {
  // ======================================================
  // GET ALL PRODUCTS
  // ======================================================

  async getProducts() {
    return productRepository.findAll();
  },

  // ======================================================
  // GET PRODUCT BY ID
  // ======================================================

  async getProductById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Product ID is required");
    }

    const product = await productRepository.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  },

  // ======================================================
  // GET PRODUCT BY SLUG
  // ======================================================

  async getProductBySlug(slug: string) {
    if (!slug || slug.trim() === "") {
      throw new Error("Product slug is required");
    }

    const product = await productRepository.findBySlug(slug);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  },

  // ======================================================
  // CREATE PRODUCT
  // ======================================================

  async createProduct(data: CreateProductInput) {
    const existingProduct =
      await productRepository.findBySlug(data.slug);

    if (existingProduct) {
      throw new Error("Product slug already exists");
    }

    const createData: Prisma.ProductCreateInput = {
      name: data.name,
      slug: data.slug,

      description: data.description,
      shortDescription: data.shortDescription,

      status: data.status,

      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice,

      brand: data.brand,

      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,

      // --------------------------------------------------
      // CATEGORIES
      // --------------------------------------------------

      categories:
        data.categoryIds.length > 0
          ? {
              create: data.categoryIds.map((categoryId) => ({
                category: {
                  connect: {
                    id: categoryId,
                  },
                },
              })),
            }
          : undefined,

      // --------------------------------------------------
      // COLLECTIONS
      // --------------------------------------------------

      collections:
        data.collectionIds.length > 0
          ? {
              create: data.collectionIds.map(
                (collectionId) => ({
                  collection: {
                    connect: {
                      id: collectionId,
                    },
                  },
                }),
              ),
            }
          : undefined,

      // --------------------------------------------------
      // IMAGES
      // --------------------------------------------------

      images:
        data.images.length > 0
          ? {
              create: data.images.map((image) => ({
                url: image.url,
                alt: image.alt,

                sortOrder: image.sortOrder,

                isPrimary: image.isPrimary,
              })),
            }
          : undefined,

      // --------------------------------------------------
      // VARIANTS + INVENTORY
      // --------------------------------------------------

      variants:
        data.variants.length > 0
          ? {
              create: data.variants.map((variant) => ({
                sku: variant.sku,

                colorId: variant.colorId,
                sizeId: variant.sizeId,

                priceOverride:
                  variant.priceOverride,

                costPrice: variant.costPrice,

                barcode: variant.barcode,

                isActive: variant.isActive,

                inventory: variant.inventory
                  ? {
                      create: {
                        quantity:
                          variant.inventory.quantity,

                        reserved:
                          variant.inventory.reserved,

                        lowStockAt:
                          variant.inventory.lowStockAt,
                      },
                    }
                  : undefined,
              })),
            }
          : undefined,
    };

    return productRepository.create(createData);
  },

  // ======================================================
  // UPDATE PRODUCT
  // ======================================================

  async updateProduct(
    data: UpdateProductInput,
  ) {
    const { id, ...updateData } = data;

    const existingProduct =
      await productRepository.findById(id);

    if (!existingProduct) {
      throw new Error("Product not found");
    }

    // --------------------------------------------------
    // Check slug conflict
    // --------------------------------------------------

    if (updateData.slug) {
      const productWithSlug =
        await productRepository.findBySlug(
          updateData.slug,
        );

      if (
        productWithSlug &&
        productWithSlug.id !== id
      ) {
        throw new Error("Product slug already exists");
      }
    }

    // --------------------------------------------------
    // Build Prisma update data
    // --------------------------------------------------

    const prismaData: Prisma.ProductUpdateInput = {
      name: updateData.name,

      slug: updateData.slug,

      description:
        updateData.description,

      shortDescription:
        updateData.shortDescription,

      status:
        updateData.status,

      basePrice:
        updateData.basePrice,

      compareAtPrice:
        updateData.compareAtPrice,

      brand:
        updateData.brand,

      metaTitle:
        updateData.metaTitle,

      metaDescription:
        updateData.metaDescription,
    };

    return productRepository.update(
      id,
      prismaData,
    );
  },

  // ======================================================
  // DELETE PRODUCT
  // ======================================================

  async deleteProduct(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Product ID is required");
    }

    const existingProduct =
      await productRepository.findById(id);

    if (!existingProduct) {
      throw new Error("Product not found");
    }

    return productRepository.delete(id);
  },
};