import AdminSidebar from "@peated/web/components/admin/sidebar";
import Layout from "@peated/web/components/layout";
import type React from "react";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Layout sidebar={<AdminSidebar />}>{children}</Layout>;
}
