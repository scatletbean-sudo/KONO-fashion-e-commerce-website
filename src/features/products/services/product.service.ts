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

  // --------------------------------------------------
  // Check product exists
  // --------------------------------------------------

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
  // TRANSACTION
  // --------------------------------------------------

  await productRepository.transaction(async (tx) => {
    // ==================================================
    // 1. UPDATE PRODUCT BASIC INFORMATION
    // ==================================================

    const prismaData: Prisma.ProductUpdateInput = {
      ...(updateData.name !== undefined && {
        name: updateData.name,
      }),

      ...(updateData.slug !== undefined && {
        slug: updateData.slug,
      }),

      ...(updateData.description !== undefined && {
        description: updateData.description,
      }),

      ...(updateData.shortDescription !== undefined && {
        shortDescription: updateData.shortDescription,
      }),

      ...(updateData.status !== undefined && {
        status: updateData.status,
      }),

      ...(updateData.basePrice !== undefined && {
        basePrice: updateData.basePrice,
      }),

      ...(updateData.compareAtPrice !== undefined && {
        compareAtPrice: updateData.compareAtPrice,
      }),

      ...(updateData.brand !== undefined && {
        brand: updateData.brand,
      }),

      ...(updateData.metaTitle !== undefined && {
        metaTitle: updateData.metaTitle,
      }),

      ...(updateData.metaDescription !== undefined && {
        metaDescription: updateData.metaDescription,
      }),
    };

    await tx.product.update({
      where: {
        id,
      },

      data: prismaData,
    });

    // ==================================================
    // 2. CATEGORIES
    // ==================================================

    if (updateData.categoryIds !== undefined) {
      await tx.productCategory.deleteMany({
        where: {
          productId: id,
        },
      });

      if (updateData.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: updateData.categoryIds.map(
            (categoryId) => ({
              productId: id,
              categoryId,
            }),
          ),
          skipDuplicates: true,
        });
      }
    }

    // ==================================================
    // 3. COLLECTIONS
    // ==================================================

    if (updateData.collectionIds !== undefined) {
      await tx.productCollection.deleteMany({
        where: {
          productId: id,
        },
      });

      if (updateData.collectionIds.length > 0) {
        await tx.productCollection.createMany({
          data: updateData.collectionIds.map(
            (collectionId) => ({
              productId: id,
              collectionId,
            }),
          ),
          skipDuplicates: true,
        });
      }
    }

    // ==================================================
    // 4. IMAGES
    // ==================================================

    if (updateData.images !== undefined) {
      await tx.productImage.deleteMany({
        where: {
          productId: id,
        },
      });

      if (updateData.images.length > 0) {
        await tx.productImage.createMany({
          data: updateData.images.map((image) => ({
            productId: id,
            url: image.url,
            alt: image.alt,
            sortOrder: image.sortOrder,
            isPrimary: image.isPrimary,
          })),
        });
      }
    }

    // ==================================================
    // 5. VARIANTS
    // ==================================================

    if (updateData.variants !== undefined) {
      for (const variant of updateData.variants) {
        // ------------------------------------------------
        // UPDATE EXISTING VARIANT
        // ------------------------------------------------

        if (variant.id) {
          const existingVariant =
            await tx.productVariant.findFirst({
              where: {
                id: variant.id,
                productId: id,
              },
            });

          if (!existingVariant) {
            throw new Error(
              `Variant not found: ${variant.id}`,
            );
          }

          await tx.productVariant.update({
            where: {
              id: variant.id,
            },

            data: {
              sku: variant.sku,
              colorId: variant.colorId,
              sizeId: variant.sizeId,
              priceOverride:
                variant.priceOverride,
              costPrice:
                variant.costPrice,
              barcode:
                variant.barcode,
              isActive:
                variant.isActive,
            },
          });

          // ----------------------------------------------
          // INVENTORY
          // ----------------------------------------------

          if (variant.inventory !== undefined) {
            await tx.inventory.upsert({
              where: {
                variantId: variant.id,
              },

              create: {
                variantId: variant.id,
                quantity:
                  variant.inventory.quantity,
                reserved:
                  variant.inventory.reserved,
                lowStockAt:
                  variant.inventory.lowStockAt,
              },

              update: {
                quantity:
                  variant.inventory.quantity,
                reserved:
                  variant.inventory.reserved,
                lowStockAt:
                  variant.inventory.lowStockAt,
              },
            });
          }
        }

        // ------------------------------------------------
        // CREATE NEW VARIANT
        // ------------------------------------------------

        else {
          await tx.productVariant.create({
            data: {
              productId: id,

              sku: variant.sku,

              colorId:
                variant.colorId,

              sizeId:
                variant.sizeId,

              priceOverride:
                variant.priceOverride,

              costPrice:
                variant.costPrice,

              barcode:
                variant.barcode,

              isActive:
                variant.isActive,

              inventory:
                variant.inventory
                  ? {
                      create: {
                        quantity:
                          variant.inventory
                            .quantity,

                        reserved:
                          variant.inventory
                            .reserved,

                        lowStockAt:
                          variant.inventory
                            .lowStockAt,
                      },
                    }
                  : undefined,
            },
          });
        }
      }
    }
  });

  // --------------------------------------------------
  // RETURN UPDATED PRODUCT
  // --------------------------------------------------

  return productRepository.findById(id);
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
}