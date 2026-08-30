import { getPublicStats } from "@peated/web/lib/publicStats.server";
import type { ReactNode } from "react";
import { ApplicationLayout } from "./_components/applicationLayout.stylex";

export default async function ApplicationRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const stats = await getPublicStats().catch(() => undefined);

  return <ApplicationLayout initialStats={stats}>{children}</ApplicationLayout>;
}
