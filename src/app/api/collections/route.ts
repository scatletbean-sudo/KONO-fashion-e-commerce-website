import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { createCollectionSchema } from "@/features/products/collections/schemas/collection.schema";
import { collectionService } from "@/features/products/collections/services/collection.service";

// GET /api/collections
export async function GET() {
  try {
    const collections =
      await collectionService.getCollections();

    return catalogResponse("collections", collections);
  } catch (error) {
    return catalogError(error);
  }
}

// POST /api/collections
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const result =
      createCollectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const collection =
      await collectionService.createCollection(
        result.data,
      );

    return NextResponse.json(
      {
        success: true,
        data: collection,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/collections error:", error);

    if (
      error instanceof Error &&
      error.message ===
        "Collection slug already exists"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create collection",
      },
      { status: 500 },
    );
  }
}