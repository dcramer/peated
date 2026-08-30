import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  AppLink,
  BottleVisual,
  Card,
  CardActionLink,
  CardLink,
  CardPrimaryLink,
  SectionHeading,
} from "../components";

export type HomeCriticReview = {
  bottleHref: string;
  bottleName: string;
  date: ReactNode;
  imageUrl?: string | null;
  metadata: readonly string[];
  rating?: number | null;
  source: string;
  sourceHref: string;
};

export function CriticReviewCards({
  reviews,
}: {
  reviews: readonly HomeCriticReview[];
}) {
  return (
    <section aria-label="From the critics">
      <SectionHeading>From the critics</SectionHeading>
      <div {...stylex.props(styles.criticGrid)}>
        {reviews.map((review) => (
          <Card
            appearance="surface"
            key={review.sourceHref}
            linked
            padding="none"
            {...stylex.props(styles.criticCard)}
          >
            <BottleVisual
              imageUrl={review.imageUrl}
              label={review.bottleName}
            />
            <div {...stylex.props(styles.criticCopy)}>
              <div {...stylex.props(styles.sourceLine)}>
                <CardActionLink
                  href={review.sourceHref}
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(styles.sourceLink)}
                >
                  {review.source}
                </CardActionLink>
                <span aria-hidden="true"> · </span>
                {review.date}
              </div>
              <div {...stylex.props(styles.criticTitleLine)}>
                <CardPrimaryLink href={review.bottleHref}>
                  <span {...stylex.props(styles.criticTitle)}>
                    {review.bottleName}
                  </span>
                </CardPrimaryLink>
                {review.rating === null ||
                review.rating === undefined ? null : (
                  <strong {...stylex.props(styles.criticRating)}>
                    {review.rating}
                  </strong>
                )}
              </div>
              {review.metadata.length ? (
                <div {...stylex.props(styles.metadata)}>
                  {review.metadata.join(" · ")}
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export type HomeFollowedRelease = {
  bottleHref: string;
  bottleName: string;
  distiller: string;
  imageUrl?: string | null;
  metadata: readonly string[];
};

export function FollowedReleaseList({
  followedDistillerCount,
  releases,
  seeAllHref,
}: {
  followedDistillerCount: number;
  releases: readonly HomeFollowedRelease[];
  seeAllHref: string;
}) {
  return (
    <section aria-label="New from distillers you follow">
      <SectionHeading>New from distillers you follow</SectionHeading>
      <div {...stylex.props(styles.releaseList)}>
        {releases.map((release) => (
          <CardLink
            appearance="surface"
            href={release.bottleHref}
            key={release.bottleHref}
            padding="none"
            {...stylex.props(styles.release)}
          >
            <BottleVisual
              imageUrl={release.imageUrl}
              label={release.bottleName}
              size="sm"
            />
            <div {...stylex.props(styles.releaseCopy)}>
              <div {...stylex.props(styles.releaseDistiller)}>
                {release.distiller}
              </div>
              <span {...stylex.props(styles.releaseName)}>
                {release.bottleName}
              </span>
              {release.metadata.length ? (
                <div {...stylex.props(styles.metadata)}>
                  {release.metadata.join(" · ")}
                </div>
              ) : null}
            </div>
            <span {...stylex.props(styles.newLabel)}>new</span>
          </CardLink>
        ))}
      </div>
      <div {...stylex.props(styles.releaseFooter)}>
        <span {...stylex.props(styles.followingCount)}>
          Following {followedDistillerCount.toLocaleString("en-US")} distiller
          {followedDistillerCount === 1 ? "" : "s"}
        </span>
        <AppLink href={seeAllHref} {...stylex.props(styles.seeAll)}>
          See all <span aria-hidden="true">→</span>
        </AppLink>
      </div>
    </section>
  );
}

const COMPACT = "@media (max-width: 639px)";

const styles = stylex.create({
  criticGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x3,
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  criticCard: {
    display: "flex",
    gap: "14px",
    paddingTop: "22px",
    paddingRight: space.x6,
    paddingBottom: "22px",
    paddingLeft: space.x6,
    [COMPACT]: {
      paddingTop: space.x4,
      paddingRight: space.x4,
      paddingBottom: space.x4,
      paddingLeft: space.x4,
    },
  },
  criticCopy: {
    minWidth: 0,
    flex: 1,
  },
  sourceLine: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sourceLink: {
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
  },
  criticTitleLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "10px",
    marginTop: "6px",
  },
  criticTitle: {
    display: "block",
    minWidth: 0,
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textWrap: "pretty",
  },
  criticRating: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  metadata: {
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  releaseList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: space.x3,
  },
  release: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    paddingTop: "14px",
    paddingRight: space.x4,
    paddingBottom: "14px",
    paddingLeft: space.x4,
    color: colors.ink,
    textDecoration: "none",
  },
  releaseCopy: {
    minWidth: 0,
    flex: 1,
  },
  releaseDistiller: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  releaseName: {
    display: "block",
    overflow: "hidden",
    marginTop: "2px",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  newLabel: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  releaseFooter: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x3,
  },
  followingCount: {
    minWidth: 0,
    flex: 1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  seeAll: {
    flexShrink: 0,
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.ink,
    },
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
