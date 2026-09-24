import { NextRequest, NextResponse } from "next/server";

import {
  colorIdSchema,
  colorSlugSchema,
  createColorSchema,
} from "@/features/products/colors/schemas/color.schema";

import { colorService } from "@/features/products/colors/services/color.service";

export async function GET() {
  try {
    const colors = await colorService.getColors();

    return NextResponse.json({
      success: true,
      data: colors,
    });
  } catch (error) {
    console.error("GET /api/colors error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch colors",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = createColorSchema.safeParse(body);

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

    const color = await colorService.createColor(result.data);

    return NextResponse.json(
      {
        success: true,
        data: color,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/colors error:", error);

    if (
      error instanceof Error &&
      error.message === "Color slug already exists"
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
        message: "Failed to create color",
      },
      { status: 500 },
    );
  }
}