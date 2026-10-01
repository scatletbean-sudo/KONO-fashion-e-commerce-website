import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/admin-guard";
import { paymentService } from "@/features/payments/services/payment.service";
import { updatePaymentStatusSchema } from "@/features/payments/schemas/payment.schema";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
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
    const { id } = await context.params;
    const body = await request.json();

    const parsed =
      updatePaymentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payment = await paymentService.updateStatus(
      id,
      parsed.data,
    );

    return NextResponse.json({
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Payment not found") {
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 },
        );
      }

      if (
        error.message.startsWith(
          "Cannot change payment status",
        ) ||
        error.message.startsWith(
          "Payment is already",
        )
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }
    }

    console.error("PATCH payment status error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}