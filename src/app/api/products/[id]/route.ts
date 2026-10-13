import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { productService } from "@/features/products/services/product.service";
import { updateProductSchema } from "@/features/products/schemas/product.schema";
import { attributeErrorResponse } from "@/lib/admin/api/attribute-errors";
import { MediaError } from "@/features/products/images/media-policy";
import { mediaErrorResponse } from "@/lib/admin/api/media";

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

    return catalogResponse("products", product);
  } catch (error) {
    return catalogError(error);
  }
}

// PATCH /api/products/:id
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

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
    const attributeError = attributeErrorResponse(error);
    if (error instanceof MediaError) return mediaErrorResponse(error);
    if (attributeError) return attributeError;
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

// Shared by the legacy and ADMIN routes. Permanent deletion is disabled until
// dependency/history checks can prevent unsafe Prisma cascades.
export async function DELETE() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: "Permanent product deletion is not supported yet. To archive a product, explicitly confirm and save ARCHIVED through PATCH instead.",
      },
      { status: 409 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not verify admin access." },
      { status: 500 },
    );
  }
}
