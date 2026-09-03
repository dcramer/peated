import { getTastingPage } from "@peated/web/lib/tastingPage.server";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Edit Tasting",
  robots: { index: false, follow: false },
};

export default async function TastingEditLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await params;
  await getTastingPage(tastingId);
  return children;
}
