import type { ReactNode } from "react";

/** Supplies a server layout boundary for routes that only add metadata. */
export default function DefaultLayout({ children }: { children: ReactNode }) {
  return children;
}
