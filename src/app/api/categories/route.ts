import { NextRequest, NextResponse } from "next/server";

import { categoryService } from "@/features/products/categories/services/category.service";
import { createCategorySchema } from "@/features/products/categories/schemas/category.schema";

// GET /api/categories
export async function GET() {
  try {
    const categories = await categoryService.getCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("GET /api/categories error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch categories",
      },
      { status: 500 },
    );
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = createCategorySchema.safeParse(body);

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

    const category = await categoryService.createCategory(
      result.data,
    );

    return NextResponse.json(
      {
        success: true,
        data: category,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/categories error:", error);

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

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create category",
      },
      { status: 500 },
    );
  }
}