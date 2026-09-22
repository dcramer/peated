import { getSession } from "@peated/web/lib/session.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

// The overview reads administrator-only operations data, so moderators start
// at the Inbox instead.
export default async function OverviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session.user?.admin) {
    redirect("/admin/moderation/inbox");
  }
  return children;
}
