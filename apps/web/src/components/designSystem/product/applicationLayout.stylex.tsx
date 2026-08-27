"use client";

import * as stylex from "@stylexjs/stylex";
import { CircleUserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useTransition } from "react";
import useAuth from "../../../hooks/useAuth";
import { logout } from "../../../lib/auth.actions";
import { colors, controlMetrics } from "../../../styles/tokens.stylex";
import { ApplicationHeader, ButtonLink } from "../components";
import { PageFrame } from "../patterns/pagePatternShell.stylex";
import { ApplicationFooter } from "./applicationFooter.stylex";
import { Search } from "./search.stylex";

const databaseItems = [
  { href: "/bottles", label: "Bottles" },
  { href: "/locations", label: "Locations" },
  { href: "/distillers", label: "Distillers" },
  { href: "/brands", label: "Brands" },
  { href: "/bottlers", label: "Bottlers" },
] as const;

function AccountVisual({
  pictureUrl,
  username,
}: {
  pictureUrl?: string | null;
  username?: string;
}) {
  if (pictureUrl) {
    return (
      <img alt="" src={pictureUrl} {...stylex.props(styles.accountImage)} />
    );
  }

  if (username) {
    return (
      <span aria-hidden="true" {...stylex.props(styles.accountInitials)}>
        {username.slice(0, 2).toLocaleUpperCase()}
      </span>
    );
  }

  return <CircleUserRound aria-hidden="true" size={19} />;
}

export function ApplicationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [logoutPending, startLogout] = useTransition();
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
      footer={<ApplicationFooter />}
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
          currentHref={pathname}
          databaseItems={databaseItems}
          personalItems={personalItems}
          search={pathname === "/search" ? undefined : <Search />}
          showNavigation={Boolean(user)}
        />
      }
    >
      {children}
    </PageFrame>
  );
}

const styles = stylex.create({
  accountImage: {
    display: "block",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  accountInitials: {
    display: "inline-flex",
    width: "26px",
    height: "26px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
    color: colors.ink,
    fontSize: "10px",
    fontWeight: 700,
    lineHeight: 1,
  },
});
