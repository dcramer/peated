import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";

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
          <strong {...stylex.props(styles.publication)}>{publication}</strong>
          {byline ? (
            <span {...stylex.props(styles.byline)}>{byline}</span>
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

      {summary ? <p {...stylex.props(styles.summary)}>{summary}</p> : null}
      {href ? (
        <a href={href} {...stylex.props(styles.reviewLink)}>
          Read the full review on {publication} →
        </a>
      ) : null}
    </article>
  );
}

const styles = stylex.create({
  review: {
    width: "100%",
    paddingTop: "14px",
    paddingBottom: "14px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
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
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  byline: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  rating: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  summary: {
    maxWidth: "68ch",
    margin: 0,
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.55,
  },
  reviewLink: {
    display: "inline-block",
    marginTop: space.x3,
    borderRadius: "2px",
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.ink,
    },
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
