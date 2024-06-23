import "@fontsource/raleway/index.css";
import "@peated/web/styles/index.css";
import React from "react";
import Layout from "../../components/layout";

export default async function DefaultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Layout>{children}</Layout>;
}
