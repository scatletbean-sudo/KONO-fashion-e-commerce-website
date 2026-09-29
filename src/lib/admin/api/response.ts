import { NextResponse } from "next/server";

export function adminSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      data,
      ...(meta ? { meta } : {}),
    },
    { status: 200 },
  );
}

export function adminError(
  code: string,
  message: string,
  status: number,
  issues?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(issues !== undefined ? { issues } : {}),
      },
    },
    { status },
  );
}