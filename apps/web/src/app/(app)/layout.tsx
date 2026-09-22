import { getSession } from "@peated/web/lib/session.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationLayout } from "./_components/applicationLayout.stylex";

export default async function ApplicationRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  // A suspended member can only manage their account; see
  // docs/architecture/account-access.md.
  const session = await getSession();
  if (session.user?.suspendedAt) {
    redirect("/auth/suspended");
  }
  return <ApplicationLayout>{children}</ApplicationLayout>;
}
