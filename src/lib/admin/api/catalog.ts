import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { catalogError } from "@/features/products/public-catalog";

export async function adminCatalogGet(load: () => Promise<unknown>) {
  try {
    if (!await getAdminSession()) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: await load() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return catalogError(error);
  }
}
