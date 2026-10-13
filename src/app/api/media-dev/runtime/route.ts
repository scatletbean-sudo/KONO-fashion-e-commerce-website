import { NextResponse } from "next/server";
import { verifyMediaDevelopmentRuntime } from "@/features/products/images/services/media-dev-runtime.service";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (process.env.KONO_MEDIA_DEV_RUNTIME !== "1" || process.env.NODE_ENV !== "development"
    || request.headers.get("host") !== "127.0.0.1:3001") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }
  try {
    const identity = await verifyMediaDevelopmentRuntime();
    const session = await getAdminSession();
    const product = await prisma.product.findUnique({ where: { id: "cmuedw86k0000q0ufukh57s7m" },
      select: { id: true, name: true, status: true, _count: { select: { images: true } } } });
    return NextResponse.json({ success: true, identity, adminAuthenticated: !!session, product,
      cloudinaryConfigured: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every(key => !!process.env[key]) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ success: false, message: "Media development runtime verification failed." }, { status: 503 }); }
}
