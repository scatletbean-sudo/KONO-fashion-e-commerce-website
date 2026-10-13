import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { assertMediaOrigin, mediaErrorResponse } from "@/lib/admin/api/media";
import { signProductImageSchema } from "@/features/products/images/schemas/product-image.schema";
import { productImageService } from "@/features/products/images/services/product-image.service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    assertMediaOrigin(request);
    const parsed = signProductImageSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid image upload request." }, { status: 400 });
    const data = await productImageService.signUpload(parsed.data, session.user.id);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
