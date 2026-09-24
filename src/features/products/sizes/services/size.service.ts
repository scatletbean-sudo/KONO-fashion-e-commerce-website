import { Prisma } from "@/generated/prisma/client";

import { sizeRepository } from "../repositories/size.repository";

import type {
  CreateSizeInput,
  UpdateSizeInput,
} from "../schemas/size.schema";

export const sizeService = {
  async getSizes() {
    return sizeRepository.findAll();
  },

  async getSizeById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Size ID is required");
    }

    const size = await sizeRepository.findById(id);

    if (!size) {
      throw new Error("Size not found");
    }

    return size;
  },

  async getSizeBySlug(slug: string) {
    if (!slug || slug.trim() === "") {
      throw new Error("Size slug is required");
    }

    const size = await sizeRepository.findBySlug(slug);

    if (!size) {
      throw new Error("Size not found");
    }

    return size;
  },

  async createSize(data: CreateSizeInput) {
    const existingSize =
      await sizeRepository.findBySlug(data.slug);

    if (existingSize) {
      throw new Error("Size slug already exists");
    }

    const createData: Prisma.SizeCreateInput = {
      name: data.name,
      slug: data.slug,
      sortOrder: data.sortOrder,
    };

    return sizeRepository.create(createData);
  },

  async updateSize(data: UpdateSizeInput) {
    const { id, ...updateData } = data;

    const existingSize =
      await sizeRepository.findById(id);

    if (!existingSize) {
      throw new Error("Size not found");
    }

    if (updateData.slug) {
      const sizeWithSlug =
        await sizeRepository.findBySlug(updateData.slug);

      if (
        sizeWithSlug &&
        sizeWithSlug.id !== id
      ) {
        throw new Error("Size slug already exists");
      }
    }

    const prismaData: Prisma.SizeUpdateInput = {
      name: updateData.name,
      slug: updateData.slug,
      sortOrder: updateData.sortOrder,
    };

    return sizeRepository.update(id, prismaData);
  },

  async deleteSize(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Size ID is required");
    }

    const existingSize =
      await sizeRepository.findById(id);

    if (!existingSize) {
      throw new Error("Size not found");
    }

    return sizeRepository.delete(id);
  },
};