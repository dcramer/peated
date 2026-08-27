import Layout from "@peated/web/components/layout";
import { type Metadata } from "next";
import { type ReactNode } from "react";
import EntityListSidebar from "../rightSidebar";

export const metadata: Metadata = {
  title: "Search Whisky Distillers",
};

export default async function BottlesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout rightSidebar={<EntityListSidebar kind="distillery" />}>
      {children}
    </Layout>
  );
}
