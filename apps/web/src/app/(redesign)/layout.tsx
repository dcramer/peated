import { ApplicationLayout } from "@peated/web/components/designSystem/product/applicationLayout.stylex";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import type { ReactNode } from "react";

export default async function RedesignLayout({
  children,
}: {
  children: ReactNode;
}) {
  const stats = await getPublicStats().catch(() => undefined);

  return <ApplicationLayout initialStats={stats}>{children}</ApplicationLayout>;
}
