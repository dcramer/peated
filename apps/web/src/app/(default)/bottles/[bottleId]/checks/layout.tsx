import { ErrorPageForbidden } from "@peated/web/components/errorPage";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { getSession } from "@peated/web/lib/session.server";
import type { ReactNode } from "react";
import BottleFullHeader from "../bottleFullHeader";
import BottleTabs from "../bottleTabs";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ bottleId: string }>;
}) {
  const session = await getSession();
  if (!session.user?.mod && !session.user?.admin) {
    return <ErrorPageForbidden />;
  }

  const { bottleId } = await params;
  const bottle = await getBottlePage(Number(bottleId));

  return (
    <>
      <BottleFullHeader bottle={bottle} />
      <BottleTabs bottle={bottle} />
      {children}
    </>
  );
}
