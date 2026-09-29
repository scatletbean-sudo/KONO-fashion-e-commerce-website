import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionService } from "@/features/auth/services/session.service";

const SESSION_COOKIE_NAME = "kono_session";

export async function getAdminSession() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await sessionService.getSessionByToken(token);

  if (!session) {
    return null;
  }

  if (session.user.status !== "ACTIVE") {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}