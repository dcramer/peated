import { getEntityPage } from "@peated/web/lib/entityPage.server";
import type { ReactNode } from "react";

export default async function EntityRouteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  await getEntityPage(Number(entityId));
  return children;
}
