import { NextResponse } from "next/server";

import { dashboardService } from "@/features/dashboard/services/dashboard.service";
import { requireAdminSession } from "@/lib/auth/admin-guard";

export async function GET() {
  try {
    await requireAdminSession();

    const summary = await dashboardService.getSummary();

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("DASHBOARD SUMMARY ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard summary" },
      { status: 500 },
    );
  }
}