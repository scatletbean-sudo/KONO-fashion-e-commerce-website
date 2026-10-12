import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import {
  createSizeSchema,
} from "@/features/products/sizes/schemas/size.schema";

import { sizeService } from "@/features/products/sizes/services/size.service";

export async function GET() {
  try {
    const sizes = await sizeService.getSizes();

    return catalogResponse("sizes", sizes);
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

    const validation = createSizeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid size data",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const size = await sizeService.createSize(validation.data);

    return NextResponse.json(
      {
        success: true,
        data: size,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Size slug already exists"
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
        message: "Failed to create size",
      },
      { status: 500 },
    );
  }
}