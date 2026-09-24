import { NextRequest, NextResponse } from "next/server";

import {
  createProductImageSchema,
} from "@/features/products/images/schemas/product-image.schema";

import { productImageService } from "@/features/products/images/services/product-image.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const productId = searchParams.get("productId");

    if (productId) {
      const data =
        await productImageService.getImagesByProductId(
          productId,
        );

      return NextResponse.json({
        success: true,
        data,
      });
    }

    const data = await productImageService.getImages();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch product images";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result =
      createProductImageSchema.safeParse(body);

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
      await productImageService.createImage(
        result.data,
      );

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create product image";

    if (
      message.includes("Unique constraint") ||
      message.includes("Foreign key constraint")
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 409 },
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