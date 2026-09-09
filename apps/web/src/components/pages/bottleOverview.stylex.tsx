import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { AppLink } from "@peated/web/components/appLink";
import type { BottleListItem } from "@peated/web/components/bottleList.stylex";
import { BottleVisual } from "@peated/web/components/bottleVisual.stylex";
import type { FactListItem } from "@peated/web/components/factList.stylex";
import {
  FactList,
  hasVisibleFacts,
} from "@peated/web/components/factList.stylex";
import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { ImageAttribution } from "@peated/web/components/imageAttribution.stylex";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, space } from "../../styles/tokens.stylex";
import { CommunityFeed, type CommunityFeedItem } from "../communityFeed.stylex";
import { BottleRailSection } from "./bottleRailSection.stylex";

const NARROW = "@media (max-width: 759px)";
const loadingDelays = [0, 1, 2, 3] as const;

export type BottleOverviewImage = {
  label: string;
  license?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
};

export type BottleOverviewProps = {
  declaredFacts: readonly [FactListItem, ...FactListItem[]];
  flavorProfile?: ReactNode;
  image: BottleOverviewImage;
  mainState?: ReactNode;
  moreReviewsAndTastingsHref?: string;
  recommendationHeading?: string;
  recommendationState?: ReactNode;
  recommendations?: readonly BottleListItem[];
  railSections?: ReactNode;
  reviewAndTastingCount?: number;
  reviewsAndTastings?: readonly CommunityFeedItem[];
};

/** Composes bottle facts, image, reviews, and tastings, with its flavor profile above related bottles. */
export function BottleOverview({
  declaredFacts,
  flavorProfile,
  image,
  mainState,
  moreReviewsAndTastingsHref,
  recommendationHeading = "If you liked this",
  recommendationState,
  recommendations = [],
  railSections,
  reviewAndTastingCount,
  reviewsAndTastings = [],
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
          {reviewsAndTastings.length ? (
            <section {...stylex.props(styles.section)}>
              <SectionHeading>Reviews</SectionHeading>
              <CommunityFeed
                ariaLabel="Bottle reviews and tastings"
                items={reviewsAndTastings}
              />
              {moreReviewsAndTastingsHref &&
              reviewAndTastingCount !== undefined &&
              reviewAndTastingCount > reviewsAndTastings.length ? (
                <AppLink
                  href={moreReviewsAndTastingsHref}
                  {...stylex.props(
                    foundationStyles.interactiveSmall,
                    styles.moreLink,
                  )}
                >
                  Show all {reviewAndTastingCount.toLocaleString("en-US")}{" "}
                  reviews →
                </AppLink>
              ) : null}
            </section>
          ) : null}

          {!reviewsAndTastings.length ? mainState : null}
        </div>
      </div>

      <aside
        aria-label="Bottle image, flavor profile, and recommendations"
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

        {flavorProfile ||
        recommendations.length ||
        recommendationState ||
        railSections ? (
          <div {...stylex.props(styles.railSections)}>
            {flavorProfile}
            {recommendations.length ? (
              <BottleRailSection
                heading={recommendationHeading}
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
          <LoadingList
            label="Loading bottle recommendations"
            rows={3}
            variant="sidebar"
          />
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
    display: { default: "flex", ":empty": "none" },
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
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
