import { NextRequest, NextResponse } from "next/server";

import {
  productImageIdSchema,
  updateProductImageSchema,
} from "@/features/products/images/schemas/product-image.schema";

import { productImageService } from "@/features/products/images/services/product-image.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const validation =
      productImageIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product image ID",
        },
        { status: 400 },
      );
    }

    const data =
      await productImageService.getImageById(id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch product image";

    if (message === "Product image not found") {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message,
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
    const { id } = await context.params;

    const body = await request.json();

    const result =
      updateProductImageSchema.safeParse({
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

    const data =
      await productImageService.updateImage(
        result.data,
      );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update product image";

    if (message === "Product image not found") {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message,
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
    const { id } = await context.params;

    const validation =
      productImageIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product image ID",
        },
        { status: 400 },
      );
    }

    const data =
      await productImageService.deleteImage(id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete product image";

    if (message === "Product image not found") {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}