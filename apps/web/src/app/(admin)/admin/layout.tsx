import { ErrorPageForbidden } from "@peated/web/components/errorPage";
import { redirectToAuth } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import { type Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function DefaultLayout({
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

  if (!session.user?.admin) {
    return <ErrorPageForbidden />;
  }

  return <>{children}</>;
}
