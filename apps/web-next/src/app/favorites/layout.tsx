import Layout from "@peated/web/components/layout";
import SimpleHeader from "@peated/web/components/simpleHeader";
import { type Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Favorites",
};

export default function PageLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <Layout>
      <SimpleHeader>Favorites</SimpleHeader>
      {children}
    </Layout>
  );
}
