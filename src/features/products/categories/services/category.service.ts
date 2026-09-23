import { categoryRepository } from "../repositories/category.repository";

import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";

export const categoryService = {
  async getCategories() {
    return categoryRepository.findAll();
  },

  async getCategoryById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Category ID is required");
    }

    const category = await categoryRepository.findById(id);

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  },

  async getCategoryBySlug(slug: string) {
    if (!slug || slug.trim() === "") {
      throw new Error("Category slug is required");
    }

    const category = await categoryRepository.findBySlug(slug);

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  },

  async createCategory(data: CreateCategoryInput) {
    const existingCategory =
      await categoryRepository.findBySlug(data.slug);

    if (existingCategory) {
      throw new Error("Category slug already exists");
    }

    if (data.parentId) {
      const parentCategory =
        await categoryRepository.findById(data.parentId);

      if (!parentCategory) {
        throw new Error("Parent category not found");
      }
    }

    return categoryRepository.create({
      name: data.name,
      slug: data.slug,
      description: data.description,
      imageUrl: data.imageUrl,
      isActive: data.isActive,

      parent: data.parentId
        ? {
            connect: {
              id: data.parentId,
            },
          }
        : undefined,
    });
  },

  async updateCategory(data: UpdateCategoryInput) {
    const { id, ...updateData } = data;

    const existingCategory =
      await categoryRepository.findById(id);

    if (!existingCategory) {
      throw new Error("Category not found");
    }

    if (updateData.slug) {
      const categoryWithSlug =
        await categoryRepository.findBySlug(updateData.slug);

      if (
        categoryWithSlug &&
        categoryWithSlug.id !== id
      ) {
        throw new Error("Category slug already exists");
      }
    }

    if (updateData.parentId !== undefined) {
      if (updateData.parentId === id) {
        throw new Error(
          "Category cannot be its own parent",
        );
      }

      if (updateData.parentId) {
        const parentCategory =
          await categoryRepository.findById(
            updateData.parentId,
          );

        if (!parentCategory) {
          throw new Error("Parent category not found");
        }

        let currentParentId =
          parentCategory.parentId;

        while (currentParentId) {
          if (currentParentId === id) {
            throw new Error(
              "Category hierarchy would create a cycle",
            );
          }

          const ancestor =
            await categoryRepository.findById(
              currentParentId,
            );

          if (!ancestor) {
            break;
          }

          currentParentId = ancestor.parentId;
        }
      }
    }

    return categoryRepository.update(id, {
      name: updateData.name,
      slug: updateData.slug,
      description: updateData.description,
      imageUrl: updateData.imageUrl,
      isActive: updateData.isActive,

      parent:
        updateData.parentId === undefined
          ? undefined
          : updateData.parentId === null
            ? {
                disconnect: true,
              }
            : {
                connect: {
                  id: updateData.parentId,
                },
              },
    });
  },

  async deleteCategory(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Category ID is required");
    }

    const existingCategory =
      await categoryRepository.findById(id);

    if (!existingCategory) {
      throw new Error("Category not found");
    }

    return categoryRepository.delete(id);
  },
};