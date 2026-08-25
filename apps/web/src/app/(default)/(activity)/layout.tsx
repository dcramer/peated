import PendingTosAlert from "@peated/web/components/pendingTosAlert";
import PendingVerificationAlert from "@peated/web/components/pendingVerificationAlert";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      {user && !user.termsAcceptedAt && <PendingTosAlert />}
      {user && !user.verified && <PendingVerificationAlert />}
      {children}
    </>
  );
}
