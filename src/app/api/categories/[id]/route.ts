import { NextRequest, NextResponse } from "next/server";

import { categoryService } from "@/features/products/categories/services/category.service";
import { updateCategorySchema } from "@/features/products/categories/schemas/category.schema";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/categories/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const category =
      await categoryService.getCategoryById(id);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(
      "GET /api/categories/[id] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Category ID is required"
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
      error.message === "Category not found"
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
        message: "Failed to fetch category",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/categories/:id
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const result = updateCategorySchema.safeParse({
      ...body,
      id,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid category data",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const category =
      await categoryService.updateCategory(result.data);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(
      "PATCH /api/categories/[id] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Category not found"
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
      error.message === "Category slug already exists"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Parent category not found"
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
      (
        error.message ===
          "Category cannot be its own parent" ||
        error.message ===
          "Category hierarchy would create a cycle"
      )
    ) {
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
        message: "Failed to update category",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/categories/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const category =
      await categoryService.deleteCategory(id);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(
      "DELETE /api/categories/[id] error:",
      error,
    );

    if (
      error instanceof Error &&
      error.message === "Category ID is required"
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
      error.message === "Category not found"
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
        message: "Failed to delete category",
      },
      { status: 500 },
    );
  }
}