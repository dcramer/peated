import type { ReactNode } from "react";
import Layout from "../components/layout";

interface DefaultLayoutProps {
  children: ReactNode;
}

export default function DefaultLayout({ children }: DefaultLayoutProps) {
  return <Layout>{children}</Layout>;
}
