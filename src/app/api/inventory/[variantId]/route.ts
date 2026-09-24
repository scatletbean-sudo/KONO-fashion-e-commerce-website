import { NextRequest, NextResponse } from "next/server";

import {
  updateInventorySchema,
} from "@/features/inventory/schemas/inventory.schema";

import {
  inventoryService,
} from "@/features/inventory/services/inventory.service";

type RouteContext = {
  params: Promise<{
    variantId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { variantId } = await context.params;

    const inventory =
      await inventoryService.getInventoryByVariantId(
        variantId,
      );

    return NextResponse.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error(
      "GET /api/inventory/[variantId] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Inventory not found"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get inventory",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { variantId } = await context.params;

    const inventory =
      await inventoryService.getInventoryByVariantId(
        variantId,
      );

    const body = await request.json();

    const parsed =
      updateInventorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid inventory data",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const updatedInventory =
      await inventoryService.updateInventory(
        inventory.id,
        parsed.data,
      );

    return NextResponse.json({
      success: true,
      data: updatedInventory,
    });
  } catch (error) {
    console.error(
      "PATCH /api/inventory/[variantId] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Inventory not found"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "Reserved quantity cannot be greater than quantity"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update inventory",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { variantId } = await context.params;

    const inventory =
      await inventoryService.getInventoryByVariantId(
        variantId,
      );

    const deletedInventory =
      await inventoryService.deleteInventory(
        inventory.id,
      );

    return NextResponse.json({
      success: true,
      data: deletedInventory,
    });
  } catch (error) {
    console.error(
      "DELETE /api/inventory/[variantId] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Inventory not found"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete inventory",
      },
      { status: 500 },
    );
  }
}