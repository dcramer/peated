import { ErrorPageForbidden } from "@peated/web/components/errorPage";
import { redirectToAuth } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session.user) {
    redirectToAuth({ pathname: "/bottle-checks" });
  }
  if (!session.user?.mod && !session.user?.admin) {
    return <ErrorPageForbidden />;
  }
  return children;
}
