"use client";

import { PublicHome } from "@peated/web/app/(app)/_components/home/publicHome.stylex";
import type { ReactNode } from "react";

export function HomePageClient({
  children,
  searchPlaceholder,
}: {
  children: ReactNode;
  searchPlaceholder: string;
}) {
  return (
    <PublicHome content={children} searchPlaceholder={searchPlaceholder} />
  );
}
