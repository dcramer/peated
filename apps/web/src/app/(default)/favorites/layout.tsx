import SimpleHeader from "@peated/web/components/simpleHeader";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { type Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Favorites",
};

export default async function Layout({ children }: { children: ReactNode }) {
  if (!(await isLoggedIn())) {
    return redirectToAuth({ pathname: "/favorites" });
  }

  return (
    <>
      <SimpleHeader>Favorites</SimpleHeader>
      {children}
    </>
  );
}
