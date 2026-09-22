import { ForbiddenPage } from "@peated/web/components/errors/errorPages.stylex";
import { redirectToAuth } from "@peated/web/lib/auth";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import { getSession } from "@peated/web/lib/session.server";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import React from "react";

export const metadata: Metadata = {
  title: "Admin",
  ...noIndexPageMetadata,
};

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: move to middleware?
  const session = await getSession();
  if (!session.user) {
    redirectToAuth({
      pathname: "/admin",
    });
  }

  if (session.user?.suspendedAt) {
    redirect("/auth/suspended");
  }

  // Moderators reach the Moderation and Content sections; see
  // docs/features/moderation-workspace.md.
  if (!session.user?.admin && !session.user?.mod) {
    return <ForbiddenPage route="/admin" />;
  }

  return children;
}
