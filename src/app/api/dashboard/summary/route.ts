import { NextResponse } from "next/server";

import { dateRangeSchema } from "@/lib/admin/query/date-range.schema";
import { dashboardService } from "@/features/dashboard/services/dashboard.service";
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

    const result = dateRangeSchema.safeParse({
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

    const overview = await dashboardService.getOverview(result.data);

    return NextResponse.json(overview, { status: 200 });
  } catch (error) {
    console.error("DASHBOARD OVERVIEW ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard overview" },
      { status: 500 },
    );
  }
}