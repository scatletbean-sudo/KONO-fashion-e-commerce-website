import { productImageRepository } from "../repositories/product-image.repository";
import { createSignedUpload, verifyCloudinaryResource, verifyUploadTicket } from "../cloudinary.server";
import { MAX_PRODUCT_IMAGES, MediaError, validateGalleryOrder, validateImageFile } from "../media-policy";
import type { CreateProductImageInput, UpdateProductImageInput } from "../schemas/product-image.schema";

export const productImageService = {
  getImages: () => productImageRepository.findAll(),
  async getImageById(id: string) {
    const image = await productImageRepository.findById(id);
    if (!image) throw new MediaError("Product image not found", 404);
    return image;
  },
  getImagesByProductId: (productId: string) => productImageRepository.findByProductId(productId),

  async signUpload(data: { productId: string; size: number; type: string }, adminId: string) {
    validateImageFile(data);
    if (!(await productImageRepository.productExists(data.productId))) throw new MediaError("Product not found", 404);
    if ((await productImageRepository.findByProductId(data.productId)).length >= MAX_PRODUCT_IMAGES) {
      throw new MediaError("A product can have at most 24 images.", 409);
    }
    return createSignedUpload(data.productId, adminId, data);
  },

  async createImage(data: CreateProductImageInput, adminId: string) {
    verifyUploadTicket(data.uploadToken, data.productId, adminId, data.publicId);
    const verified = await verifyCloudinaryResource(data.publicId);
    return productImageRepository.transaction(data.productId, async tx => {
      const images = await tx.productImage.findMany({ where: { productId: data.productId }, orderBy: { sortOrder: "asc" } });
      const attached = images.find(image => image.cloudinaryPublicId === verified.cloudinaryPublicId);
      if (attached) {
        if (attached.cloudinaryAssetId !== verified.cloudinaryAssetId) throw new MediaError("Cloudinary resource identity changed.", 409);
        return attached; // Safe retry if attachment committed but its response was lost.
      }
      if (images.length >= MAX_PRODUCT_IMAGES) throw new MediaError("A product can have at most 24 images.", 409);
      const primary = data.isPrimary === true || !images.some(image => image.isPrimary);
      if (primary) await tx.productImage.updateMany({ where: { productId: data.productId }, data: { isPrimary: false } });
      return tx.productImage.create({ data: { ...verified, productId: data.productId, alt: data.alt,
        imageType: data.imageType ?? "PRODUCT", isPrimary: primary,
        sortOrder: images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1 } });
    });
  },

  async updateImage(data: UpdateProductImageInput) {
    const existing = await this.getImageById(data.id);
    return productImageRepository.transaction(existing.productId, async tx => {
      const current = await tx.productImage.findUnique({ where: { id: data.id } });
      if (!current || current.productId !== existing.productId) throw new MediaError("Product image not found", 404);
      if (data.isPrimary === false && current.isPrimary) throw new MediaError("Choose another Primary Image instead of clearing it.");
      if (data.sortOrder !== undefined && data.sortOrder !== current.sortOrder) throw new MediaError("Use gallery reorder to change image order.");
      if (data.isPrimary) await tx.productImage.updateMany({ where: { productId: current.productId }, data: { isPrimary: false } });
      const { id, ...metadata } = data;
      return tx.productImage.update({ where: { id }, data: metadata });
    });
  },

  async reorderImages(productId: string, ids: string[]) {
    return productImageRepository.transaction(productId, async tx => {
      const images = await tx.productImage.findMany({ where: { productId } });
      validateGalleryOrder(ids, images.map(image => image.id));
      for (const [sortOrder, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { sortOrder } });
      return tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } });
    });
  },

  async deleteImage(id: string) {
    const existing = await this.getImageById(id);
    return productImageRepository.transaction(existing.productId, async tx => {
      const current = await tx.productImage.findUnique({ where: { id } });
      if (!current || current.productId !== existing.productId) throw new MediaError("Product image not found", 404);
      const remaining = await tx.productImage.findMany({ where: { productId: current.productId, id: { not: id } }, orderBy: { sortOrder: "asc" } });
      const product = await tx.product.findUnique({ where: { id: current.productId }, select: { status: true } });
      if (product?.status === "ACTIVE" && !remaining.length) throw new MediaError("An ACTIVE product needs an image. Save it as DRAFT or ARCHIVED before removing its last image.", 409);
      await tx.productImage.delete({ where: { id } });
      if (current.isPrimary && remaining.length) {
        await tx.productImage.updateMany({ where: { productId: current.productId }, data: { isPrimary: false } });
        await tx.productImage.update({ where: { id: remaining[0].id }, data: { isPrimary: true } });
      }
      // Remove the product association only; never destroy legacy or shared originals.
      return current;
    });
  },
};
