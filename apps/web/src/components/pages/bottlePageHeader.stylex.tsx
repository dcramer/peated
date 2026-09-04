import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { BottleRatingSummaryProps } from "..";
import { AppLink, BottleRatingSummary } from "..";
import { colors, effects, space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";

const NARROW = "@media (max-width: 900px)";

export type BottlePageHeaderProps = {
  actions?: ReactNode;
  brand: string;
  brandHref?: string;
  metadata?: ReactNode;
  menu?: ReactNode;
  name: string;
  rating?: BottleRatingSummaryProps | null;
};

/** Presents a bottle's catalog identity, member actions, and community ratings. */
export function BottlePageHeader({
  actions,
  brand,
  brandHref,
  metadata,
  menu,
  name,
  rating,
}: BottlePageHeaderProps) {
  const hasRatings = Boolean(rating);

  return (
    <div {...stylex.props(styles.root, hasRatings && styles.rootWithRatings)}>
      <PageHeader
        actions={actions}
        actionsPosition="start"
        metadata={metadata}
        menu={menu}
        title={
          <>
            {brandHref ? (
              <AppLink
                href={brandHref}
                title={brand}
                {...stylex.props(styles.brand)}
              >
                {brand}
              </AppLink>
            ) : (
              <span title={brand}>{brand}</span>
            )}{" "}
            {name}
          </>
        }
      />
      {rating ? (
        <div {...stylex.props(styles.ratings)}>
          <BottleRatingSummary {...rating} />
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    boxSizing: "border-box",
    display: "grid",
    width: "100%",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  rootWithRatings: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 260px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x6,
  },
  brand: {
    outline: "none",
    color: {
      default: "inherit",
      ":hover": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "3px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  ratings: {
    boxSizing: "border-box",
    display: "grid",
    minWidth: 0,
    gridColumn: { default: "2", [NARROW]: "1" },
    gridRow: { default: "1", [NARROW]: "auto" },
    gridTemplateColumns: "minmax(0, 1fr)",
    paddingTop: { default: space.x4, [NARROW]: 0 },
    paddingBottom: { default: space.x4, [NARROW]: 0 },
  },
});
