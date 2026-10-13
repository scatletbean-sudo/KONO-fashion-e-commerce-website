import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextResponse } from "next/server";
import { assertMediaOrigin, mediaErrorResponse } from "@/lib/admin/api/media";
import { updateProductImageSchema } from "@/features/products/images/schemas/product-image.schema";
import { productImageService } from "@/features/products/images/services/product-image.service";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { return catalogResponse("images", await productImageService.getImageById((await params).id)); }
  catch (error) { return catalogError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    if (!(await getAdminSession())) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    assertMediaOrigin(request);
    const result = updateProductImageSchema.safeParse({ ...await request.json(), id: (await params).id });
    if (!result.success) return NextResponse.json({ success: false, message: "Validation failed", errors: result.error.flatten() }, { status: 400 });
    const data = await productImageService.updateImage(result.data);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    if (!(await getAdminSession())) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    assertMediaOrigin(request);
    const data = await productImageService.deleteImage((await params).id);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
