import { Prisma } from "@/generated/prisma/client";

import { colorRepository } from "../repositories/color.repository";

import type {
  CreateColorInput,
  UpdateColorInput,
} from "../schemas/color.schema";

export const colorService = {
  async getColors() {
    return colorRepository.findAll();
  },

  async getColorById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Color ID is required");
    }

    const color = await colorRepository.findById(id);

    if (!color) {
      throw new Error("Color not found");
    }

    return color;
  },

  async getColorBySlug(slug: string) {
    if (!slug || slug.trim() === "") {
      throw new Error("Color slug is required");
    }

    const color = await colorRepository.findBySlug(slug);

    if (!color) {
      throw new Error("Color not found");
    }

    return color;
  },

  async createColor(data: CreateColorInput) {
    const existingColor =
      await colorRepository.findBySlug(data.slug);

    if (existingColor) {
      throw new Error("Color slug already exists");
    }

    const createData: Prisma.ColorCreateInput = {
      name: data.name,
      slug: data.slug,
      hexCode: data.hexCode,
    };

    return colorRepository.create(createData);
  },

  async updateColor(data: UpdateColorInput) {
    const { id, ...updateData } = data;

    const existingColor =
      await colorRepository.findById(id);

    if (!existingColor) {
      throw new Error("Color not found");
    }

    if (updateData.slug) {
      const colorWithSlug =
        await colorRepository.findBySlug(updateData.slug);

      if (
        colorWithSlug &&
        colorWithSlug.id !== id
      ) {
        throw new Error("Color slug already exists");
      }
    }

    const prismaData: Prisma.ColorUpdateInput = {
      name: updateData.name,
      slug: updateData.slug,
      hexCode: updateData.hexCode,
    };

    return colorRepository.update(id, prismaData);
  },

  async deleteColor(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Color ID is required");
    }

    const existingColor =
      await colorRepository.findById(id);

    if (!existingColor) {
      throw new Error("Color not found");
    }

    return colorRepository.delete(id);
  },
};