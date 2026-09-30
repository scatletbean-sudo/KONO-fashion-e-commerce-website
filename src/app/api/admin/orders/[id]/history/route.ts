import { NextResponse } from "next/server";

import { orderStatusHistoryService } from "@/features/orders/services/order-status-history.service";
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

    const history =
      await orderStatusHistoryService.getOrderHistory(id);

    return NextResponse.json(history, { status: 200 });
  } catch (error) {
    console.error("ORDER STATUS HISTORY ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load order status history" },
      { status: 500 },
    );
  }
}