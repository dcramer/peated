import type { ExternalReviewScoreContribution } from "@peated/server/schemas";
import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { TextLink } from "./textLink.stylex";

export type CriticReviewProps = {
  href?: string;
  publication: string;
  publishedAt?: string;
  nativeScore?: { value: number; scale: number } | null;
  scoreContribution?: ExternalReviewScoreContribution;
  reviewerName?: string;
  summary?: string;
};

/** Shows the publication's original score and whether it enters the bottle score. */
export function CriticReview({
  href,
  publication,
  publishedAt,
  nativeScore,
  scoreContribution,
  reviewerName,
  summary,
}: CriticReviewProps) {
  const byline = [reviewerName ? `By ${reviewerName}` : null, publishedAt]
    .filter(Boolean)
    .join(" · ");

  return (
    <article {...stylex.props(styles.review)}>
      <div {...stylex.props(styles.heading)}>
        <div {...stylex.props(styles.source)}>
          <strong
            {...stylex.props(
              foundationStyles.compactRowTitle,
              styles.publication,
            )}
          >
            {publication}
          </strong>
          {byline ? (
            <span {...stylex.props(foundationStyles.metadata, styles.byline)}>
              {byline}
            </span>
          ) : null}
        </div>
        {nativeScore ? (
          <span
            role="img"
            aria-label={`${publication} score ${nativeScore.value} out of ${nativeScore.scale}`}
            {...stylex.props(styles.rating)}
          >
            {nativeScore.value}
            <span {...stylex.props(foundationStyles.metadata, styles.scale)}>
              /{nativeScore.scale}
            </span>
          </span>
        ) : null}
      </div>

      {nativeScore && scoreContribution ? (
        <p {...stylex.props(foundationStyles.metadata, styles.contribution)}>
          {scoreContribution.value === null
            ? "Not included in the bottle score."
            : nativeScore.scale === 100 &&
                scoreContribution.value === nativeScore.value
              ? "Included in the bottle score."
              : `Counts as an estimated ${scoreContribution.value}/100 in the bottle score.`}{" "}
          <TextLink href="/about/ratings" size="inherit">
            How scores work
          </TextLink>
          {scoreContribution.guideUrl ? (
            <>
              {" "}
              ·{" "}
              <TextLink href={scoreContribution.guideUrl} size="inherit">
                Scoring guide
              </TextLink>
            </>
          ) : null}
        </p>
      ) : null}

      {summary ? (
        <p {...stylex.props(foundationStyles.prose, styles.summary)}>
          {summary}
        </p>
      ) : null}

      {href ? (
        <div {...stylex.props(foundationStyles.metadata, styles.reviewLink)}>
          <TextLink href={href} size="inherit">
            Read the full review on {publication} →
          </TextLink>
        </div>
      ) : null}
    </article>
  );
}

const styles = stylex.create({
  review: {
    width: "100%",
    paddingTop: "14px",
    paddingBottom: "14px",
  },
  heading: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
  },
  source: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  publication: {
    color: colors.ink,
  },
  byline: {
    color: colors.inkMuted,
  },
  rating: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  scale: {
    marginLeft: space.x1,
    color: colors.inkMuted,
    letterSpacing: "normal",
  },
  contribution: {
    marginTop: space.x3,
    marginBottom: 0,
    color: colors.inkMuted,
  },
  summary: {
    maxWidth: "54ch",
    marginTop: space.x3,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.ink,
    textWrap: "pretty",
  },
  reviewLink: {
    marginTop: space.x3,
  },
});
