import Layout from "@peated/web/components/layout";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import EntityListSidebar from "../rightSidebar";

export const metadata: Metadata = { title: "Search Whisky Companies" };

export default function CompaniesLayout({ children }: { children: ReactNode }) {
  return (
    <Layout rightSidebar={<EntityListSidebar kind="company" />}>
      {children}
    </Layout>
  );
}
