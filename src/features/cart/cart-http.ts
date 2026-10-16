import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CartError } from "./cart-contract";
const cookieName = "kono_bag";
export async function cartOwner() {
  const token = (await cookies()).get(cookieName)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? createHash("sha256").update(token).digest("hex") : null;
}
export function newCartOwner() {
  const token = randomBytes(32).toString("hex");
  return { token, sessionId: createHash("sha256").update(token).digest("hex") };
}
export function cartResponse(data: unknown, token?: string) {
  const response = NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  if (token) response.cookies.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
export function assertCartOrigin(request: Request) {
  const local = process.env.NODE_ENV === "development" && process.env.KONO_MEDIA_DEV_RUNTIME === "1" && request.headers.get("host") === "127.0.0.1:3001";
  const expected = local ? "http://127.0.0.1:3001" : new URL(request.url).origin;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new CartError("Yêu cầu không hợp lệ.", 403);
}
export function cartError(error: unknown) {
  return NextResponse.json({ success: false, message: error instanceof CartError ? error.message : error instanceof SyntaxError ? "Yêu cầu không hợp lệ." : "Chưa thể cập nhật giỏ hàng. Vui lòng thử lại." }, { status: error instanceof CartError ? error.status : error instanceof SyntaxError ? 400 : 503, headers: { "Cache-Control": "private, no-store" } });
}
