import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { productService } from "@/features/products/services/product.service";
import { createProductSchema } from "@/features/products/schemas/product.schema";
import { attributeErrorResponse } from "@/lib/admin/api/attribute-errors";
import { MediaError } from "@/features/products/images/media-policy";
import { mediaErrorResponse } from "@/lib/admin/api/media";

export async function GET() {
  try {
    const products = await productService.getProducts();

    return catalogResponse("products", products);
  } catch (error) {
    return catalogError(error);
  }
}

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
    const attributeError = attributeErrorResponse(error);
    if (error instanceof MediaError) return mediaErrorResponse(error);
    if (attributeError) return attributeError;
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
