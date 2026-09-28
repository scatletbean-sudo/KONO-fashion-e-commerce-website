import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminSession } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "KONO Admin",
  description: "KONO Administration Panel",
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  await requireAdminSession();

  return <AdminShell>{children}</AdminShell>;
}