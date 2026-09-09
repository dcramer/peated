import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sign-in and catalog forms are tasks, not pages for search results.
export const metadata: Metadata = noIndexPageMetadata;

export default function LayoutFreeRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
