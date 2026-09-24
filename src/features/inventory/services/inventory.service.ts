import { Prisma } from "@/generated/prisma/client";

import { inventoryRepository } from "../repositories/inventory.repository";

import type {
  CreateInventoryInput,
  UpdateInventoryInput,
} from "../schemas/inventory.schema";

export const inventoryService = {
  async getInventories() {
    return inventoryRepository.findAll();
  },

  async getInventoryById(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Inventory ID is required");
    }

    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new Error("Inventory not found");
    }

    return inventory;
  },

  async getInventoryByVariantId(variantId: string) {
    if (!variantId || variantId.trim() === "") {
      throw new Error("Variant ID is required");
    }

    const inventory =
      await inventoryRepository.findByVariantId(variantId);

    if (!inventory) {
      throw new Error("Inventory not found");
    }

    return inventory;
  },

  async createInventory(data: CreateInventoryInput) {
    const existingInventory =
      await inventoryRepository.findByVariantId(
        data.variantId,
      );

    if (existingInventory) {
      throw new Error(
        "Inventory already exists for this variant",
      );
    }

    if (data.reserved > data.quantity) {
      throw new Error(
        "Reserved quantity cannot be greater than quantity",
      );
    }

    const createData: Prisma.InventoryCreateInput = {
      variant: {
        connect: {
          id: data.variantId,
        },
      },

      quantity: data.quantity,
      reserved: data.reserved,
      lowStockAt: data.lowStockAt,
    };

    return inventoryRepository.create(createData);
  },

  async updateInventory(
    id: string,
    data: UpdateInventoryInput,
  ) {
    if (!id || id.trim() === "") {
      throw new Error("Inventory ID is required");
    }

    const existingInventory =
      await inventoryRepository.findById(id);

    if (!existingInventory) {
      throw new Error("Inventory not found");
    }

    const quantity =
      data.quantity ?? existingInventory.quantity;

    const reserved =
      data.reserved ?? existingInventory.reserved;

    if (reserved > quantity) {
      throw new Error(
        "Reserved quantity cannot be greater than quantity",
      );
    }

    const updateData: Prisma.InventoryUpdateInput = {
      quantity: data.quantity,
      reserved: data.reserved,
      lowStockAt: data.lowStockAt,
    };

    return inventoryRepository.update(
      id,
      updateData,
    );
  },

  async deleteInventory(id: string) {
    if (!id || id.trim() === "") {
      throw new Error("Inventory ID is required");
    }

    const existingInventory =
      await inventoryRepository.findById(id);

    if (!existingInventory) {
      throw new Error("Inventory not found");
    }

    return inventoryRepository.delete(id);
  },
};