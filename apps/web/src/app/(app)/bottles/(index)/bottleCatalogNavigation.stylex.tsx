"use client";

import * as stylex from "@stylexjs/stylex";

import {
  AppLink,
  PageTabs,
} from "@peated/web/components/designSystem/components";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

export function BottleCatalogNavigation({
  allHref,
  followingHref,
  scope,
}: {
  allHref: string;
  followingHref: string;
  scope: "all" | "following";
}) {
  return (
    <div {...stylex.props(styles.navigation)}>
      <PageTabs
        ariaLabel="Bottle views"
        currentHref={scope === "following" ? followingHref : allHref}
        items={[
          { href: allHref, label: "All bottles" },
          { href: followingHref, label: "Following" },
        ]}
      />
      {scope === "following" ? (
        <p {...stylex.props(styles.scopeHelp)}>
          Bottles from distillers, brands, and bottlers you follow. See followed{" "}
          <AppLink href="/distillers?filter=following">distillers</AppLink>,{" "}
          <AppLink href="/brands?filter=following">brands</AppLink>, or{" "}
          <AppLink href="/bottlers?filter=following">bottlers</AppLink>.
        </p>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  navigation: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
  },
  scopeHelp: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
});
