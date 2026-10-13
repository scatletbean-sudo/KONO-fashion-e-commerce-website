import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { assertMediaOrigin, mediaErrorResponse } from "@/lib/admin/api/media";
import { reorderProductImagesSchema } from "@/features/products/images/schemas/product-image.schema";
import { productImageService } from "@/features/products/images/services/product-image.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getAdminSession())) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    assertMediaOrigin(request);
    const parsed = reorderProductImagesSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid gallery order." }, { status: 400 });
    const data = await productImageService.reorderImages((await params).id, parsed.data.ids);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
