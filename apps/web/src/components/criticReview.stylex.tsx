import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { TextLink } from "./textLink.stylex";

export type CriticReviewProps = {
  href?: string;
  publication: string;
  publishedAt?: string;
  rating?: number | null;
  reviewerName?: string;
  summary?: string;
};

/** Renders an attributed critic review with its normalized 100-point rating. */
export function CriticReview({
  href,
  publication,
  publishedAt,
  rating,
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
        {rating !== null && rating !== undefined ? (
          <strong
            aria-label={`${publication} critic rating ${rating} out of 100`}
            {...stylex.props(styles.rating)}
          >
            {rating}
          </strong>
        ) : null}
      </div>

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
