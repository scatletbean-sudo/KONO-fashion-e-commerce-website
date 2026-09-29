import { NextResponse } from "next/server";

import { orderListQuerySchema } from "@/features/orders/schemas/order.schema";
import { orderService } from "@/features/orders/services/order.service";
import { getAdminSession } from "@/lib/auth/admin-guard";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const result = orderListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const orders = await orderService.getOrders(result.data);

    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    console.error("GET ADMIN ORDERS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 },
    );
  }
}