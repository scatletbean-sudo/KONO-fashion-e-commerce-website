import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { sessionService } from "@/features/auth/services/session.service";

const SESSION_COOKIE_NAME = "kono_session";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await sessionService.revokeSession(sessionId);
  }

  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}