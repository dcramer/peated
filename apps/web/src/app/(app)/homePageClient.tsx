"use client";

import { PublicHome } from "@peated/web/app/(app)/_components/home/publicHome.stylex";

export function HomePageClient({
  searchPlaceholder,
}: {
  searchPlaceholder: string;
}) {
  return <PublicHome searchPlaceholder={searchPlaceholder} />;
}
