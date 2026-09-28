import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionService } from "@/features/auth/services/session.service";

const SESSION_COOKIE_NAME = "kono_session";

export async function requireAdminSession() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await sessionService.getSessionByToken(token);

  if (!session) {
    redirect("/login");
  }

  if (session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return session;
}