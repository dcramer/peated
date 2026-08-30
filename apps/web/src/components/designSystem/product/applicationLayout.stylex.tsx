"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { CircleUserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useTransition } from "react";
import useAuth from "../../../hooks/useAuth";
import { logout } from "../../../lib/auth.actions";
import { ApplicationHeader, ButtonLink, MemberAvatar } from "../components";
import { PageFrame } from "../patterns/pageLayout.stylex";
import { ApplicationFooter } from "./applicationFooter.stylex";
import { Search } from "./search.stylex";

const databaseItems = [
  { href: "/bottles", label: "Bottles" },
  { href: "/locations", label: "Locations" },
  { href: "/distillers", label: "Distillers" },
  { href: "/brands", label: "Brands" },
  { href: "/bottlers", label: "Bottlers" },
  { href: "/blenders", label: "Blenders" },
] as const;

function AccountVisual({
  pictureUrl,
  username,
}: {
  pictureUrl?: string | null;
  username?: string;
}) {
  if (username) {
    return (
      <MemberAvatar pictureUrl={pictureUrl} size="xs" username={username} />
    );
  }

  return <CircleUserRound aria-hidden="true" size={19} />;
}

export function ApplicationLayout({
  children,
  initialStats,
}: {
  children: ReactNode;
  initialStats?: Outputs["stats"];
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [logoutPending, startLogout] = useTransition();
  const isHome = pathname === "/";
  const isPublicHome = pathname === "/" && !user;
  const personalItems = user
    ? [
        {
          href: `/users/${user.username}/library`,
          label: "Library",
        },
        { href: "/tastings", label: "Tastings" },
        { href: "/friends", label: "Friends" },
      ]
    : [];
  const accountItems = user
    ? [
        { href: `/users/${user.username}`, label: "Profile" },
        { href: "/settings", label: "Settings" },
        {
          disabled: logoutPending,
          label: logoutPending ? "Signing out…" : "Sign out",
          onSelect: () => startLogout(() => logout()),
        },
      ]
    : undefined;

  return (
    <PageFrame
      footer={<ApplicationFooter stats={initialStats} />}
      header={
        <ApplicationHeader
          account={
            user ? (
              <AccountVisual
                pictureUrl={user.pictureUrl}
                username={user.username}
              />
            ) : undefined
          }
          accountItems={accountItems}
          accountLabel={user ? "Open account menu" : "Open sign in menu"}
          action={
            user ? (
              <ButtonLink
                href="/addBottle?intent=tasting"
                size="sm"
                variant="accent"
              >
                Log a tasting
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" size="sm" variant="text">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/register" size="sm" variant="default">
                  Create account
                </ButtonLink>
              </>
            )
          }
          background={isHome ? "page" : "surface"}
          currentHref={pathname}
          databaseItems={databaseItems}
          navigationPlacement={isPublicHome ? "inline" : "separate"}
          personalItems={personalItems}
          search={
            pathname === "/search" || isPublicHome ? undefined : (
              <Search scopeValues={user ? undefined : ["all"]} />
            )
          }
        />
      }
    >
      {children}
    </PageFrame>
  );
}
