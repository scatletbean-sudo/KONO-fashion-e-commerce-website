import { NextRequest, NextResponse } from "next/server";

import { productService } from "@/features/products/services/product.service";
import { updateProductSchema } from "@/features/products/schemas/product.schema";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/products/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const product = await productService.getProductById(id);

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);

    if (
      error instanceof Error &&
      error.message === "Product ID is required"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Product not found"
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
        message: "Failed to fetch product",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/products/:id
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const result = updateProductSchema.safeParse({
      ...body,
      id,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product data",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const product = await productService.updateProduct(result.data);

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error);

    if (
      error instanceof Error &&
      error.message === "Product not found"
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
      error.message === "Product slug already exists"
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
        message: "Failed to update product",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/products/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const product = await productService.deleteProduct(id);

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);

    if (
      error instanceof Error &&
      error.message === "Product ID is required"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Product not found"
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
        message: "Failed to delete product",
      },
      { status: 500 },
    );
  }
}