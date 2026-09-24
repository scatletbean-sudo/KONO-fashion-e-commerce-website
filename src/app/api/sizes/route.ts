import { NextRequest, NextResponse } from "next/server";

import {
  createSizeSchema,
} from "@/features/products/sizes/schemas/size.schema";

import { sizeService } from "@/features/products/sizes/services/size.service";

export async function GET() {
  try {
    const sizes = await sizeService.getSizes();

    return NextResponse.json({
      success: true,
      data: sizes,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get sizes",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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