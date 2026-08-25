import Layout from "@peated/web/components/layout";
import { type Metadata } from "next";
import { type ReactNode } from "react";
import EntityListSidebar from "../sidebar";

export const metadata: Metadata = {
  title: "Search Whisky Bottlers",
};

export default async function BottlesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout leftSidebar={<EntityListSidebar type="bottler" />}>
      {children}
    </Layout>
  );
}
