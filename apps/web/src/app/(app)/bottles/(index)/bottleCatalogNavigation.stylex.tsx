"use client";

import * as stylex from "@stylexjs/stylex";

import { PageTabs, TextLink } from "@peated/web/components";
import { foundationStyles } from "../../../../styles/foundations.stylex";
import { colors, space } from "../../../../styles/tokens.stylex";

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
        <p {...stylex.props(foundationStyles.body, styles.scopeHelp)}>
          Bottles from distillers, brands, and bottlers you follow. See followed{" "}
          <TextLink href="/distillers?filter=following" size="inherit">
            distillers
          </TextLink>
          ,{" "}
          <TextLink href="/brands?filter=following" size="inherit">
            brands
          </TextLink>
          , or{" "}
          <TextLink href="/bottlers?filter=following" size="inherit">
            bottlers
          </TextLink>
          .
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
  },
});
