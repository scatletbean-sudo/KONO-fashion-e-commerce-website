import { NextResponse } from "next/server";

import { orderService } from "@/features/orders/services/order.service";
import { getAdminSession } from "@/lib/auth/admin-guard";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 },
      );
    }

    const order = await orderService.getOrderById(id);

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Order not found"
    ) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }

    console.error("ORDER DETAIL ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load order" },
      { status: 500 },
    );
  }
}