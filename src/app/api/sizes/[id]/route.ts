import { NextRequest, NextResponse } from "next/server";

import {
  sizeIdSchema,
  updateSizeSchema,
} from "@/features/products/sizes/schemas/size.schema";

import { sizeService } from "@/features/products/sizes/services/size.service";

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

    const validation = sizeIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid size ID",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const size = await sizeService.getSizeById(id);

    return NextResponse.json({
      success: true,
      data: size,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Size not found"
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
        message: "Failed to get size",
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

    const validation = updateSizeSchema.safeParse({
      ...body,
      id,
    });

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

    const size = await sizeService.updateSize(
      validation.data,
    );

    return NextResponse.json({
      success: true,
      data: size,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Size not found"
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
        message: "Failed to update size",
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

    const validation = sizeIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid size ID",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const size = await sizeService.deleteSize(id);

    return NextResponse.json({
      success: true,
      data: size,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Size not found"
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
        message: "Failed to delete size",
      },
      { status: 500 },
    );
  }
}