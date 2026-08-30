import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import type {
  CriticReviewProps,
  FactListItem,
  TastingEntryProps,
} from "../components";
import {
  CriticReview,
  FactList,
  hasVisibleFacts,
  RailList,
  RailListItem,
  SectionHeading,
  TastingEntry,
} from "../components";

const RAIL_SHRINKS = "@media (max-width: 1040px)";
const RAIL_FOLDS = "@media (max-width: 900px)";
const RAIL_STACKS = "@media (max-width: 680px)";

export type BottleRecommendation = {
  end?: ReactNode;
  href: string;
  metadata?: string;
  name: string;
};

export type BottleOverviewProps = {
  criticReviewCount?: number;
  criticReviewDetail?: string;
  criticReviews?: readonly CriticReviewProps[];
  declaredFacts: readonly [FactListItem, ...FactListItem[]];
  mainState?: ReactNode;
  moreTastingsHref?: string;
  recommendationHeading?: string;
  recommendationIntro?: string;
  recommendations?: readonly BottleRecommendation[];
  tastingCount?: number;
  tastings?: readonly TastingEntryProps[];
};

/** Composes the bounded content section beneath a bottle's page header. */
export function BottleOverview({
  criticReviewCount,
  criticReviewDetail,
  criticReviews = [],
  declaredFacts,
  mainState,
  moreTastingsHref,
  recommendationHeading = "If you liked this",
  recommendationIntro,
  recommendations = [],
  tastingCount,
  tastings = [],
}: BottleOverviewProps) {
  const hasDeclaredFacts = hasVisibleFacts(declaredFacts);
  const hasRail = hasDeclaredFacts || recommendations.length > 0;

  return (
    <div {...stylex.props(styles.layout, !hasRail && styles.layoutWithoutRail)}>
      <div {...stylex.props(styles.main)}>
        {criticReviews.length ? (
          <section {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.sectionHeader)}>
              <SectionHeading count={criticReviewCount}>
                Critic reviews
              </SectionHeading>
              {criticReviewDetail ? (
                <span {...stylex.props(styles.sectionDetail)}>
                  {criticReviewDetail}
                </span>
              ) : null}
            </div>
            <div>
              {criticReviews.map((review, index) => (
                <CriticReview
                  {...review}
                  key={`${review.publication}-${review.publishedAt ?? index}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        {tastings.length ? (
          <section {...stylex.props(styles.section)}>
            <SectionHeading count={tastingCount ?? tastings.length}>
              Tastings
            </SectionHeading>
            <div>
              {tastings.map((tasting, index) => (
                <TastingEntry {...tasting} key={`${tasting.author}-${index}`} />
              ))}
            </div>
            {moreTastingsHref &&
            tastingCount !== undefined &&
            tastingCount > tastings.length ? (
              <a href={moreTastingsHref} {...stylex.props(styles.moreLink)}>
                Show all {tastingCount.toLocaleString("en-US")} tastings →
              </a>
            ) : null}
          </section>
        ) : null}

        {!criticReviews.length && !tastings.length ? mainState : null}
      </div>

      {hasRail ? (
        <aside aria-label="Bottle details" {...stylex.props(styles.rail)}>
          {hasDeclaredFacts ? (
            <section {...stylex.props(styles.railSection)}>
              <h2 {...stylex.props(styles.railHeading)}>
                Declared on the label
              </h2>
              <div {...stylex.props(styles.panel)}>
                <FactList facts={declaredFacts} />
              </div>
            </section>
          ) : null}

          {recommendations.length ? (
            <section {...stylex.props(styles.railSection)}>
              <h2 {...stylex.props(styles.railHeading)}>
                {recommendationHeading}
              </h2>
              {recommendationIntro ? (
                <p {...stylex.props(styles.railIntro)}>{recommendationIntro}</p>
              ) : null}
              <RailList ariaLabel={recommendationHeading}>
                {recommendations.map((recommendation) => (
                  <RailListItem
                    end={recommendation.end}
                    href={recommendation.href}
                    key={recommendation.href}
                    metadata={recommendation.metadata}
                    title={recommendation.name}
                  />
                ))}
              </RailList>
            </section>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  layout: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [RAIL_SHRINKS]: "minmax(0, 1fr) 300px",
      [RAIL_FOLDS]: "minmax(0, 1fr)",
    },
    minWidth: 0,
    alignItems: "start",
    columnGap: space.x8,
    rowGap: space.x8,
  },
  layoutWithoutRail: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  main: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  section: {
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
  },
  sectionDetail: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
    textTransform: "lowercase",
  },
  moreLink: {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    marginTop: "6px",
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.surface,
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  rail: {
    display: { default: "flex", [RAIL_FOLDS]: "grid" },
    minWidth: 0,
    flexDirection: "column",
    gridTemplateColumns: {
      default: "none",
      [RAIL_FOLDS]: "repeat(2, minmax(0, 1fr))",
      [RAIL_STACKS]: "minmax(0, 1fr)",
    },
    gap: { default: space.x6, [RAIL_FOLDS]: "6px", [RAIL_STACKS]: space.x6 },
  },
  railSection: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
  },
  railHeading: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  railIntro: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
  panel: {
    paddingTop: space.x1,
    paddingRight: space.x4,
    paddingBottom: space.x1,
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
});
