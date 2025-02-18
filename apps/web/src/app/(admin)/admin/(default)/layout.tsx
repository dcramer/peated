import AdminSidebar from "@peated/web/components/admin/sidebar";
import Layout from "@peated/web/components/layout";
import React from "react";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Layout sidebar={<AdminSidebar />}>{children}</Layout>;
}
