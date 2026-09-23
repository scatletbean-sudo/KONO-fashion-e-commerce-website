import { NextRequest, NextResponse } from "next/server";

import { productService } from "@/features/products/services/product.service";
import { createProductSchema } from "@/features/products/schemas/product.schema";

export async function GET() {
  try {
    const products = await productService.getProducts();

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch products",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = createProductSchema.safeParse(body);

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

    const product = await productService.createProduct(result.data);

    return NextResponse.json(
      {
        success: true,
        data: product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/products error:", error);

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
        message: "Failed to create product",
      },
      { status: 500 },
    );
  }
}