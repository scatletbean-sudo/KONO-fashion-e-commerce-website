import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { orderService } from "@/features/orders/services/order.service";
import { updateOrderStatusSchema } from "@/features/orders/schemas/order.schema";
import { getAdminSession } from "@/lib/auth/admin-guard";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
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

    const body = await request.json();

    const input = updateOrderStatusSchema.parse(body);

    const order = await orderService.updateStatus(
      id,
      input,
      session.user.id,
    );

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Order not found"
    ) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Order is already")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith(
        "Cannot change order status",
      )
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Shipment not found for this order"
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
      );
    }

    console.error("ORDER STATUS UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 },
    );
  }
}