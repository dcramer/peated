import Layout from "@peated/web/components/layout";
import { type Metadata } from "next";
import { type ReactNode } from "react";
import BottleListSidebar from "./sidebar";

export const metadata: Metadata = {
  title: "Search Whisky Bottles",
};

export default async function BottlesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <Layout leftSidebar={<BottleListSidebar />}>{children}</Layout>;
}
