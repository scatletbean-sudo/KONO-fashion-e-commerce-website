import { Prisma } from "@/generated/prisma/client";

import { variantRepository } from "../repositories/variant.repository";

import type {
  CreateVariantInput,
  UpdateVariantInput,
} from "../schemas/variant.schema";

export const variantService = {
  async getVariants() {
    return variantRepository.findAll();
  },

  async getVariantById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Variant ID is required");
    }

    const variant = await variantRepository.findById(id);

    if (!variant) {
      throw new Error("Variant not found");
    }

    return variant;
  },

  async getVariantBySku(sku: string) {
    if (!sku || sku.trim() === "") {
      throw new Error("SKU is required");
    }

    const variant = await variantRepository.findBySku(sku);

    if (!variant) {
      throw new Error("Variant not found");
    }

    return variant;
  },

  async getVariantsByProductId(productId: string) {
    if (!productId || productId.trim() === "") {
      throw new Error("Product ID is required");
    }

    return variantRepository.findByProductId(productId);
  },

  async createVariant(data: CreateVariantInput) {
    // Check SKU
    const existingVariant =
      await variantRepository.findBySku(data.sku);

    if (existingVariant) {
      throw new Error("Variant SKU already exists");
    }

    const createData: Prisma.ProductVariantCreateInput = {
      product: {
        connect: {
          id: data.productId,
        },
      },

      sku: data.sku,

      color:
        data.colorId
          ? {
              connect: {
                id: data.colorId,
              },
            }
          : undefined,

      size:
        data.sizeId
          ? {
              connect: {
                id: data.sizeId,
              },
            }
          : undefined,

      priceOverride: data.priceOverride,

      costPrice: data.costPrice,

      barcode: data.barcode,

      isActive: data.isActive,

      inventory:
        data.inventory
          ? {
              create: {
                quantity: data.inventory.quantity,
                reserved: data.inventory.reserved,
                lowStockAt: data.inventory.lowStockAt,
              },
            }
          : undefined,
    };

    return variantRepository.create(createData);
  },

  async updateVariant(data: UpdateVariantInput) {
    const { id, ...updateData } = data;

    const existingVariant =
      await variantRepository.findById(id);

    if (!existingVariant) {
      throw new Error("Variant not found");
    }

    // Check SKU conflict
    if (updateData.sku) {
      const variantWithSku =
        await variantRepository.findBySku(updateData.sku);

      if (
        variantWithSku &&
        variantWithSku.id !== id
      ) {
        throw new Error("Variant SKU already exists");
      }
    }

    const prismaData: Prisma.ProductVariantUpdateInput = {
      sku: updateData.sku,

      color:
        updateData.colorId !== undefined
          ? updateData.colorId
            ? {
                connect: {
                  id: updateData.colorId,
                },
              }
            : {
                disconnect: true,
              }
          : undefined,

      size:
        updateData.sizeId !== undefined
          ? updateData.sizeId
            ? {
                connect: {
                  id: updateData.sizeId,
                },
              }
            : {
                disconnect: true,
              }
          : undefined,

      priceOverride: updateData.priceOverride,

      costPrice: updateData.costPrice,

      barcode: updateData.barcode,

      isActive: updateData.isActive,
    };

    return variantRepository.update(id, prismaData);
  },

  async updateInventory(
    variantId: string,
    quantity: number,
    reserved?: number,
    lowStockAt?: number,
  ) {
    if (!variantId || variantId.trim() === "") {
      throw new Error("Variant ID is required");
    }

    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    if (reserved !== undefined && reserved < 0) {
      throw new Error("Reserved cannot be negative");
    }

    if (lowStockAt !== undefined && lowStockAt < 0) {
      throw new Error(
        "Low stock threshold cannot be negative",
      );
    }

    const existingVariant =
      await variantRepository.findById(variantId);

    if (!existingVariant) {
      throw new Error("Variant not found");
    }

    if (!existingVariant.inventory) {
      throw new Error("Inventory not found");
    }

    return variantRepository.update(variantId, {
      inventory: {
        update: {
          quantity,
          reserved,
          lowStockAt,
        },
      },
    });
  },

  async deleteVariant(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Variant ID is required");
    }

    const existingVariant =
      await variantRepository.findById(id);

    if (!existingVariant) {
      throw new Error("Variant not found");
    }

    return variantRepository.delete(id);
  },
};