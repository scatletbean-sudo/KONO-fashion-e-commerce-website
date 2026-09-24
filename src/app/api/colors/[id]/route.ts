import { NextRequest, NextResponse } from "next/server";

import { colorIdSchema, updateColorSchema } from "@/features/products/colors/schemas/color.schema";
import { colorService } from "@/features/products/colors/services/color.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const validation = colorIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid color ID",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const color = await colorService.getColorById(id);

    return NextResponse.json({
      success: true,
      data: color,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Color not found"
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
        message: "Failed to get color",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = updateColorSchema.safeParse({
      ...body,
      id,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid color data",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const color = await colorService.updateColor(
      validation.data,
    );

    return NextResponse.json({
      success: true,
      data: color,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Color not found"
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
        message: "Failed to update color",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const validation = colorIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid color ID",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const color = await colorService.deleteColor(id);

    return NextResponse.json({
      success: true,
      data: color,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Color not found"
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
        message: "Failed to delete color",
      },
      { status: 500 },
    );
  }
}