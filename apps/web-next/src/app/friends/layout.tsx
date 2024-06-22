import Layout from "@peated/web/components/layout";
import SimpleHeader from "@peated/web/components/simpleHeader";
import { type Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Friends",
};

export default function PageLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <Layout>
      <SimpleHeader>Friends</SimpleHeader>
      {children}
    </Layout>
  );
}
