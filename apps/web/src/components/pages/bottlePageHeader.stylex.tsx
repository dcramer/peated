import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import type { ReviewScoreProps, TastingRatingDistributionProps } from "..";
import { AppLink, ReviewScore, TastingRatingDistribution } from "..";
import { colors, effects, space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";

const NARROW = "@media (max-width: 900px)";
const PHONE = "@media (max-width: 480px)";

export type BottlePageHeaderProps = {
  actions?: ReactNode;
  bands?: TastingRatingDistributionProps | null;
  brand: string;
  brandHref?: string;
  eyebrow?: ReactNode;
  menu?: ReactNode;
  name: string;
  score?: ReviewScoreProps | null;
};

/** Presents a bottle's catalog identity, member actions, and community ratings. */
export function BottlePageHeader({
  actions,
  bands,
  brand,
  brandHref,
  eyebrow,
  menu,
  name,
  score,
}: BottlePageHeaderProps) {
  const hasRatings = Boolean(score || bands);

  return (
    <div {...stylex.props(styles.root, hasRatings && styles.rootWithRatings)}>
      <PageHeader
        actions={actions}
        actionsPosition="start"
        eyebrow={eyebrow}
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
      {hasRatings ? (
        <div aria-label="Community ratings" {...stylex.props(styles.ratings)}>
          {score ? (
            <section {...stylex.props(styles.rating)}>
              <div {...stylex.props(styles.ratingContent)}>
                <ReviewScore {...score} />
              </div>
            </section>
          ) : null}
          {bands ? (
            <section {...stylex.props(styles.rating)}>
              <div {...stylex.props(styles.ratingLabel)}>
                <SectionHeading>Tasting ratings</SectionHeading>
              </div>
              <div {...stylex.props(styles.ratingContent)}>
                <TastingRatingDistribution {...bands} />
              </div>
            </section>
          ) : null}
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
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [NARROW]: "repeat(2, minmax(0, 1fr))",
      [PHONE]: "minmax(0, 1fr)",
    },
    gap: space.x4,
    paddingTop: { default: space.x4, [NARROW]: 0 },
    paddingBottom: { default: space.x4, [NARROW]: 0 },
  },
  rating: {
    display: { default: "block", [PHONE]: "grid" },
    minWidth: 0,
    gridTemplateColumns: {
      default: "none",
      [PHONE]: "minmax(78px, 1fr) minmax(0, 2fr)",
    },
    alignItems: "start",
    gap: { default: 0, [PHONE]: space.x3 },
  },
  ratingLabel: { marginBottom: { default: space.x2, [PHONE]: 0 } },
  ratingContent: {
    minWidth: 0,
  },
});
