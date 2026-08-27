import Layout from "@peated/web/components/layout";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import EntityListSidebar from "../rightSidebar";

export const metadata: Metadata = { title: "Search Whisky Blenders" };

export default function BlendersLayout({ children }: { children: ReactNode }) {
  return (
    <Layout rightSidebar={<EntityListSidebar kind="blender" />}>
      {children}
    </Layout>
  );
}
