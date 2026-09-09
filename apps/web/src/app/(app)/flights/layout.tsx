import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = noIndexPageMetadata;

export default function FlightsLayout({ children }: { children: ReactNode }) {
  return children;
}
