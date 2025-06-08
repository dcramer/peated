import type { ReactNode } from "react";
import Layout from "../components/layout";
import EntityListSidebar from "../components/sidebars/entitiesRightSidebar";

interface EntitiesSidebarLayoutProps {
  children: ReactNode;
  entityType: "brand" | "distiller" | "bottler";
}

export default function EntitiesSidebarLayout({
  children,
  entityType,
}: EntitiesSidebarLayoutProps) {
  return (
    <Layout rightSidebar={<EntityListSidebar type={entityType} />}>
      {children}
    </Layout>
  );
}
