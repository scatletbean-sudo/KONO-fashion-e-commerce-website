import { Prisma } from "@/generated/prisma/client";

import { productImageRepository } from "../repositories/product-image.repository";

import type {
  CreateProductImageInput,
  UpdateProductImageInput,
} from "../schemas/product-image.schema";

export const productImageService = {
  async getImages() {
    return productImageRepository.findAll();
  },

  async getImageById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Product image ID is required");
    }

    const image = await productImageRepository.findById(id);

    if (!image) {
      throw new Error("Product image not found");
    }

    return image;
  },

  async getImagesByProductId(productId: string) {
    if (!productId || productId.trim() === "") {
      throw new Error("Product ID is required");
    }

    return productImageRepository.findByProductId(productId);
  },

  async createImage(data: CreateProductImageInput) {
    if (!data.productId || data.productId.trim() === "") {
      throw new Error("Product ID is required");
    }

    if (data.isPrimary) {
      await productImageRepository.unsetPrimaryByProductId(
        data.productId,
      );
    }

    const createData: Prisma.ProductImageCreateInput = {
      url: data.url,
      alt: data.alt,
      sortOrder: data.sortOrder,
      isPrimary: data.isPrimary,

      product: {
        connect: {
          id: data.productId,
        },
      },
    };

    return productImageRepository.create(createData);
  },

  async updateImage(data: UpdateProductImageInput) {
    const { id, ...updateData } = data;

    const existingImage =
      await productImageRepository.findById(id);

    if (!existingImage) {
      throw new Error("Product image not found");
    }

    if (updateData.isPrimary === true) {
      await productImageRepository.unsetPrimaryByProductId(
        existingImage.productId,
      );
    }

    const prismaData: Prisma.ProductImageUpdateInput = {
      url: updateData.url,
      alt: updateData.alt,
      sortOrder: updateData.sortOrder,
      isPrimary: updateData.isPrimary,
    };

    return productImageRepository.update(
      id,
      prismaData,
    );
  },

  async deleteImage(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Product image ID is required");
    }

    const existingImage =
      await productImageRepository.findById(id);

    if (!existingImage) {
      throw new Error("Product image not found");
    }

    return productImageRepository.delete(id);
  },
};