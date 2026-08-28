import { ForbiddenPage } from "@peated/web/components/designSystem/product/errorPages.stylex";
import { redirectToAuth } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import "@peated/web/styles/legacy.css";
import { type Metadata } from "next";
import React from "react";

// Admin owns the remaining Tailwind boundary; public layouts load only StyleX.

export const metadata: Metadata = {
  title: "Admin",
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

  if (!session.user?.admin) {
    return <ForbiddenPage route="/admin" />;
  }

  return <div className="legacy">{children}</div>;
}
