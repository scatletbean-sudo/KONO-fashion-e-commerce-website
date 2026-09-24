import { Prisma } from "@/generated/prisma/client";

import { collectionRepository } from "../repositories/collection.repository";

import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from "../schemas/collection.schema";

export const collectionService = {
  async getCollections() {
    return collectionRepository.findAll();
  },

  async getCollectionById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Collection ID is required");
    }

    const collection =
      await collectionRepository.findById(id);

    if (!collection) {
      throw new Error("Collection not found");
    }

    return collection;
  },

  async getCollectionBySlug(slug: string) {
    if (!slug || slug.trim() === "") {
      throw new Error("Collection slug is required");
    }

    const collection =
      await collectionRepository.findBySlug(slug);

    if (!collection) {
      throw new Error("Collection not found");
    }

    return collection;
  },

  async createCollection(data: CreateCollectionInput) {
    const existingCollection =
      await collectionRepository.findBySlug(data.slug);

    if (existingCollection) {
      throw new Error("Collection slug already exists");
    }

    const createData: Prisma.CollectionCreateInput = {
      name: data.name,
      slug: data.slug,

      description: data.description,
      imageUrl: data.imageUrl,

      isFeatured: data.isFeatured,
      isActive: data.isActive,
    };

    return collectionRepository.create(createData);
  },

  async updateCollection(data: UpdateCollectionInput) {
    const { id, ...updateData } = data;

    const existingCollection =
      await collectionRepository.findById(id);

    if (!existingCollection) {
      throw new Error("Collection not found");
    }

    if (updateData.slug) {
      const collectionWithSlug =
        await collectionRepository.findBySlug(
          updateData.slug,
        );

      if (
        collectionWithSlug &&
        collectionWithSlug.id !== id
      ) {
        throw new Error(
          "Collection slug already exists",
        );
      }
    }

    const prismaData: Prisma.CollectionUpdateInput = {
      name: updateData.name,
      slug: updateData.slug,
      description: updateData.description,
      imageUrl: updateData.imageUrl,
      isFeatured: updateData.isFeatured,
      isActive: updateData.isActive,
    };

    return collectionRepository.update(
      id,
      prismaData,
    );
  },

  async deleteCollection(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Collection ID is required");
    }

    const existingCollection =
      await collectionRepository.findById(id);

    if (!existingCollection) {
      throw new Error("Collection not found");
    }

    return collectionRepository.delete(id);
  },
};