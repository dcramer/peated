import "@fontsource/raleway/index.css";
import "@peated/web/styles/index.css";
import React from "react";
import Layout from "../../components/layout";

export default async function RootLayout({
  children,
  sidebar,
}: Readonly<{
  children: React.ReactNode;
  sidebar: React.ReactNode;
}>) {
  return <Layout rightSidebar={sidebar}>{children}</Layout>;
}
