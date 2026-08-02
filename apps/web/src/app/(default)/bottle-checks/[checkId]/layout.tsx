import { ErrorPageForbidden } from "@peated/web/components/errorPage";
import { redirectToAuth } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import type { ReactNode } from "react";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ checkId: string }>;
}) {
  const session = await getSession();
  if (!session.user) {
    const { checkId } = await params;
    redirectToAuth({ pathname: `/bottle-checks/${checkId}` });
  }
  if (!session.user?.mod && !session.user?.admin) {
    return <ErrorPageForbidden />;
  }
  return children;
}
