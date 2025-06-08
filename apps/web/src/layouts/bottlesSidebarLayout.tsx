import type { ReactNode } from "react";
import Layout from "../components/layout";
import BottleListSidebar from "../components/sidebars/bottlesRightSidebar";

interface BottlesSidebarLayoutProps {
  children: ReactNode;
}

export default function BottlesSidebarLayout({
  children,
}: BottlesSidebarLayoutProps) {
  return <Layout rightSidebar={<BottleListSidebar />}>{children}</Layout>;
}
