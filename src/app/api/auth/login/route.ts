import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { loginSchema } from "@/features/auth/schemas/auth.schema";
import { authService } from "@/features/auth/services/auth.service";

const SESSION_COOKIE_NAME = "kono_session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          issues: result.error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const { user, session } =
      await authService.login(result.data);

    const response = NextResponse.json(
      {
        user,
      },
      {
        status: 200,
      },
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,

      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite: "lax",

      path: "/",

      maxAge: SESSION_MAX_AGE,

      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json(
      {
        error: "Invalid email or password",
      },
      {
        status: 401,
      },
    );
  }
}