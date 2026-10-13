import { catalogError, catalogResponse } from "@/features/products/public-catalog";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { NextResponse } from "next/server";
import { assertMediaOrigin, mediaErrorResponse } from "@/lib/admin/api/media";
import { createProductImageSchema } from "@/features/products/images/schemas/product-image.schema";
import { productImageService } from "@/features/products/images/services/product-image.service";

export async function GET(request: Request) {
  try {
    const productId = new URL(request.url).searchParams.get("productId");
    const data = productId ? await productImageService.getImagesByProductId(productId) : await productImageService.getImages();
    return catalogResponse("images", data);
  } catch (error) { return catalogError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    assertMediaOrigin(request);
    const result = createProductImageSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ success: false, message: "Validation failed", errors: result.error.flatten() }, { status: 400 });
    const data = await productImageService.createImage(result.data, session.user.id);
    return NextResponse.json({ success: true, data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
