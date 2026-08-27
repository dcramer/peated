import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { BottleVisual, SectionHeading } from "../components";

export type HomeCriticReview = {
  bottleHref: string;
  bottleName: string;
  date: ReactNode;
  imageUrl?: string | null;
  metadata: readonly string[];
  score?: ReactNode;
  source: string;
  sourceHref: string;
  summary?: ReactNode;
};

export function HomeCriticReviews({
  reviews,
}: {
  reviews: readonly HomeCriticReview[];
}) {
  return (
    <section aria-label="From the critics">
      <SectionHeading>From the critics</SectionHeading>
      <div {...stylex.props(styles.criticGrid)}>
        {reviews.map((review) => (
          <article key={review.sourceHref} {...stylex.props(styles.criticCard)}>
            <BottleVisual
              imageUrl={review.imageUrl}
              label={review.bottleName}
            />
            <div {...stylex.props(styles.criticCopy)}>
              <div {...stylex.props(styles.sourceLine)}>
                <a
                  href={review.sourceHref}
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(styles.sourceLink)}
                >
                  {review.source}
                </a>
                <span aria-hidden="true"> · </span>
                {review.date}
              </div>
              <div {...stylex.props(styles.criticTitleLine)}>
                <a
                  href={review.bottleHref}
                  {...stylex.props(styles.criticTitle)}
                >
                  {review.bottleName}
                </a>
                {review.score === undefined ? null : (
                  <strong {...stylex.props(styles.criticScore)}>
                    {review.score}
                  </strong>
                )}
              </div>
              {review.metadata.length ? (
                <div {...stylex.props(styles.metadata)}>
                  {review.metadata.join(" · ")}
                </div>
              ) : null}
              {review.summary ? (
                <p {...stylex.props(styles.summary)}>{review.summary}</p>
              ) : null}
            </div>
          </article>
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

export function HomeFollowedReleases({
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
          <article key={release.bottleHref} {...stylex.props(styles.release)}>
            <BottleVisual
              imageUrl={release.imageUrl}
              label={release.bottleName}
              size="sm"
            />
            <div {...stylex.props(styles.releaseCopy)}>
              <div {...stylex.props(styles.releaseDistiller)}>
                {release.distiller}
              </div>
              <a
                href={release.bottleHref}
                {...stylex.props(styles.releaseName)}
              >
                {release.bottleName}
              </a>
              {release.metadata.length ? (
                <div {...stylex.props(styles.metadata)}>
                  {release.metadata.join(" · ")}
                </div>
              ) : null}
            </div>
            <span {...stylex.props(styles.newLabel)}>new</span>
          </article>
        ))}
      </div>
      <div {...stylex.props(styles.releaseFooter)}>
        <span {...stylex.props(styles.followingCount)}>
          Following {followedDistillerCount.toLocaleString("en-US")} distiller
          {followedDistillerCount === 1 ? "" : "s"}
        </span>
        <a href={seeAllHref} {...stylex.props(styles.seeAll)}>
          See all <span aria-hidden="true">→</span>
        </a>
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
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    gap: "14px",
    paddingTop: "22px",
    paddingRight: space.x6,
    paddingBottom: "22px",
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
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
    color: "inherit",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  criticTitleLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: "10px",
    marginTop: "6px",
  },
  criticTitle: {
    minWidth: 0,
    flex: 1,
    outline: "none",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textDecoration: "none",
    textWrap: "pretty",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  criticScore: {
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
  summary: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
    textWrap: "pretty",
  },
  releaseList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: space.x3,
  },
  release: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: "14px",
    paddingRight: space.x4,
    paddingBottom: "14px",
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
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
    outline: "none",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
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
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
