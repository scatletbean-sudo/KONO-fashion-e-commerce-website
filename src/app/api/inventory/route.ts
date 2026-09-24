import { NextRequest, NextResponse } from "next/server";

import {
  createInventorySchema,
} from "@/features/inventory/schemas/inventory.schema";

import {
  inventoryService,
} from "@/features/inventory/services/inventory.service";

export async function GET() {
  try {
    const inventories =
      await inventoryService.getInventories();

    return NextResponse.json({
      success: true,
      data: inventories,
    });
  } catch (error) {
    console.error(
      "GET /api/inventory error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get inventories",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed =
      createInventorySchema.safeParse(body);

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

    const inventory =
      await inventoryService.createInventory(
        parsed.data,
      );

    return NextResponse.json(
      {
        success: true,
        data: inventory,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/inventory error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "Inventory already exists for this variant"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 409 },
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
        message: "Failed to create inventory",
      },
      { status: 500 },
    );
  }
}