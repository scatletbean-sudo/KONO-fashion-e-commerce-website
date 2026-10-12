import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import {
  createVariantSchema,
} from "@/features/products/variants/schemas/variant.schema";

import { variantService } from "@/features/products/variants/services/variant.service";

export async function GET(request: NextRequest) {
  try {
    const productId =
      request.nextUrl.searchParams.get("productId");

    const data = productId
      ? await variantService.getVariantsByProductId(productId)
      : await variantService.getVariants();

    return catalogResponse("variants", data);
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

    const result = createVariantSchema.safeParse(body);

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

    const data = await variantService.createVariant(
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
    if (
      error instanceof Error &&
      error.message === "Variant SKU already exists"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 409 },
      );
    }

    if (error instanceof Error) {
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
        message: "Failed to create variant",
      },
      { status: 500 },
    );
  }
}