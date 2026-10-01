import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/admin-guard";
import { paymentService } from "@/features/payments/services/payment.service";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { orderId } = await context.params;

    const payment =
      await paymentService.getPaymentByOrderId(orderId);

    return NextResponse.json({
      data: payment,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Payment not found"
    ) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 },
      );
    }

    console.error("GET payment by order error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}