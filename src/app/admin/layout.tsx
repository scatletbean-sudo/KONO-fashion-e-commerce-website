import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "KONO Admin",
  description: "KONO Administration Panel",
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}