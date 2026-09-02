import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { CriticReviewProps, FactListItem, TastingEntryProps } from "..";
import {
  AppLink,
  BottleVisual,
  CriticReview,
  FactList,
  hasVisibleFacts,
  ImageAttribution,
  ItemList,
  ItemListItem,
  LoadingList,
  LoadingPlaceholder,
  SectionHeading,
  TastingEntry,
} from "..";
import { colors, effects, fonts, space } from "../../styles/tokens.stylex";
import {
  BottleRailSection,
  type BottleRailItem,
} from "./bottleRailSection.stylex";

const NARROW = "@media (max-width: 759px)";
const loadingDelays = [0, 1, 2, 3] as const;

export type BottleRecommendation = BottleRailItem;

export type BottleOverviewImage = {
  label: string;
  license?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
};

export type BottleOverviewProps = {
  criticReviewDetail?: string;
  criticReviews?: readonly CriticReviewProps[];
  declaredFacts: readonly [FactListItem, ...FactListItem[]];
  image: BottleOverviewImage;
  mainState?: ReactNode;
  moreTastingsHref?: string;
  recommendationHeading?: string;
  recommendationIntro?: string;
  recommendationState?: ReactNode;
  recommendations?: readonly BottleRecommendation[];
  railSections?: ReactNode;
  tastingCount?: number;
  tastings?: readonly TastingEntryProps[];
};

/** Composes the bottle facts, image, reviews, tastings, and recommendations. */
export function BottleOverview({
  criticReviewDetail,
  criticReviews = [],
  declaredFacts,
  image,
  mainState,
  moreTastingsHref,
  recommendationHeading = "If you liked this",
  recommendationIntro,
  recommendationState,
  recommendations = [],
  railSections,
  tastingCount,
  tastings = [],
}: BottleOverviewProps) {
  const hasDeclaredFacts = hasVisibleFacts(declaredFacts);

  return (
    <div {...stylex.props(styles.layout)}>
      <div {...stylex.props(styles.main)}>
        {hasDeclaredFacts ? (
          <div {...stylex.props(styles.facts)}>
            <FactList facts={declaredFacts} layout="grid" />
          </div>
        ) : null}

        <div {...stylex.props(styles.content)}>
          {criticReviews.length ? (
            <section {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.sectionHeader)}>
                <SectionHeading>Critic reviews</SectionHeading>
                {criticReviewDetail ? (
                  <span {...stylex.props(styles.sectionDetail)}>
                    {criticReviewDetail}
                  </span>
                ) : null}
              </div>
              <ItemList ariaLabel="Critic reviews">
                {criticReviews.map((review, index) => (
                  <ItemListItem
                    key={`${review.publication}-${review.publishedAt ?? index}`}
                  >
                    <CriticReview {...review} />
                  </ItemListItem>
                ))}
              </ItemList>
            </section>
          ) : null}

          {tastings.length ? (
            <section {...stylex.props(styles.section)}>
              <SectionHeading>Tastings</SectionHeading>
              <ItemList ariaLabel="Bottle tastings">
                {tastings.map((tasting, index) => (
                  <ItemListItem key={`${tasting.author}-${index}`}>
                    <TastingEntry {...tasting} />
                  </ItemListItem>
                ))}
              </ItemList>
              {moreTastingsHref &&
              tastingCount !== undefined &&
              tastingCount > tastings.length ? (
                <AppLink
                  href={moreTastingsHref}
                  {...stylex.props(styles.moreLink)}
                >
                  Show all {tastingCount.toLocaleString("en-US")} tastings →
                </AppLink>
              ) : null}
            </section>
          ) : null}

          {!criticReviews.length && !tastings.length ? mainState : null}
        </div>
      </div>

      <aside
        aria-label="Bottle media and recommendations"
        {...stylex.props(styles.rail)}
      >
        <figure {...stylex.props(styles.media)}>
          <BottleVisual
            expandable
            imageUrl={image.url}
            label={image.label}
            size="xl"
          />
          {image.url && (image.sourceUrl || image.license) ? (
            <figcaption {...stylex.props(styles.caption)}>
              <ImageAttribution
                license={image.license}
                sourceUrl={image.sourceUrl}
              />
            </figcaption>
          ) : null}
        </figure>

        {recommendations.length || recommendationState || railSections ? (
          <div {...stylex.props(styles.railSections)}>
            {recommendations.length ? (
              <BottleRailSection
                heading={recommendationHeading}
                intro={recommendationIntro}
                items={recommendations}
              />
            ) : recommendationState ? (
              <BottleRailSection heading={recommendationHeading}>
                {recommendationState}
              </BottleRailSection>
            ) : null}
            {railSections}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/** Reserves the bottle overview geometry while the route streams. */
export function BottleOverviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading bottle details"
      role="status"
      {...stylex.props(styles.layout)}
    >
      <div aria-hidden="true" {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.facts, styles.loadingFacts)}>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} {...stylex.props(styles.loadingFact)}>
              <LoadingPlaceholder
                delay={loadingDelays[index % loadingDelays.length]}
                preset="metadata"
              />
              <LoadingPlaceholder
                delay={loadingDelays[(index + 1) % loadingDelays.length]}
                preset="text"
              />
            </span>
          ))}
        </div>
        <div {...stylex.props(styles.content)}>
          <LoadingList label="Loading bottle reviews and tastings" rows={3} />
        </div>
      </div>

      <aside aria-hidden="true" {...stylex.props(styles.rail)}>
        <div {...stylex.props(styles.media, styles.loadingMedia)} />
        <div {...stylex.props(styles.railSections)}>
          <LoadingPlaceholder preset="heading" />
          <LoadingList label="Loading bottle recommendations" rows={3} />
        </div>
      </aside>
    </div>
  );
}

const styles = stylex.create({
  layout: {
    display: "grid",
    gridTemplateAreas: {
      default: '"main rail"',
      [NARROW]: '"facts" "media" "content" "railSections"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    minWidth: 0,
    alignItems: "start",
    columnGap: space.x12,
  },
  main: {
    gridArea: "main",
    display: { default: "flex", [NARROW]: "contents" },
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  facts: {
    gridArea: "facts",
    minWidth: 0,
  },
  content: {
    gridArea: "content",
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  rail: {
    gridArea: "rail",
    display: { default: "flex", [NARROW]: "contents" },
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  media: {
    gridArea: "media",
    minWidth: 0,
    margin: 0,
    marginTop: space.x4,
  },
  caption: {
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  railSections: {
    gridArea: "railSections",
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  loadingFacts: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(auto-fit, minmax(160px, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x4,
    paddingTop: space.x4,
    paddingBottom: space.x4,
  },
  loadingFact: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  loadingMedia: {
    width: "100%",
    aspectRatio: "4 / 5",
    borderRadius: "3px",
    backgroundColor: colors.surface,
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
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: 0,
    borderRadius: 0,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
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
});
