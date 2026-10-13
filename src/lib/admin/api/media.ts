import { NextResponse } from "next/server";
import { MediaError } from "@/features/products/images/media-policy";
import { mediaRequestOrigin } from "@/features/products/images/media-dev-runtime";

export function assertMediaOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const localDevelopment = typeof process !== "undefined" && process.env.KONO_MEDIA_DEV_RUNTIME === "1" && process.env.NODE_ENV === "development";
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== mediaRequestOrigin(request, localDevelopment))) {
    throw new MediaError("Cross-origin media requests are not allowed.", 403);
  }
}

export function mediaErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON request." }, { status: 400 });
  const conflict = error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2025"].includes(String(error.code));
  return NextResponse.json({ success: false, message: error instanceof MediaError ? error.message : conflict ? "The gallery changed or this image was already attached. Reload and try again." : "Could not complete the media request. Check server configuration and try again." }, {
    status: error instanceof MediaError ? error.status : conflict ? 409 : 500,
    headers: { "Cache-Control": "private, no-store" },
  });
}
