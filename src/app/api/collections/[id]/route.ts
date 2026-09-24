import { NextRequest, NextResponse } from "next/server";

import {
  updateCollectionSchema,
  collectionIdSchema,
} from "@/features/products/collections/schemas/collection.schema";

import { collectionService } from "@/features/products/collections/services/collection.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/collections/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const validation =
      collectionIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid collection ID",
        },
        { status: 400 },
      );
    }

    const collection =
      await collectionService.getCollectionById(id);

    return NextResponse.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error(
      "GET /api/collections/:id error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Collection not found"
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
        message: "Failed to fetch collection",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/collections/:id
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const result =
      updateCollectionSchema.safeParse({
        ...body,
        id,
      });

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
      await collectionService.updateCollection(
        result.data,
      );

    return NextResponse.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error(
      "PATCH /api/collections/:id error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Collection not found"
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
        message: "Failed to update collection",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/collections/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const validation =
      collectionIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid collection ID",
        },
        { status: 400 },
      );
    }

    const collection =
      await collectionService.deleteCollection(id);

    return NextResponse.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error(
      "DELETE /api/collections/:id error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Collection not found"
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
        message: "Failed to delete collection",
      },
      { status: 500 },
    );
  }
}