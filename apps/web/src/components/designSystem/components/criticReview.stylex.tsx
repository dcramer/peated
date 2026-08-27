import { getAdvancedRatingBand } from "@peated/server/constants";
import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";

export type NativeReviewScore = {
  display: string;
  scale: number;
  value: number;
};

export type CriticReviewProps = {
  href?: string;
  publication: string;
  publishedAt?: string;
  reviewerName?: string;
  score?: NativeReviewScore | null;
  summary?: string;
};

/** Keeps a published review attributed and preserves its native score scale. */
export function CriticReview({
  href,
  publication,
  publishedAt,
  reviewerName,
  score,
  summary,
}: CriticReviewProps) {
  const scorePosition = score
    ? `${Math.min(100, Math.max(0, (score.value / score.scale) * 100))}%`
    : null;
  const band =
    score?.scale === 100 ? getAdvancedRatingBand(score.value) : undefined;
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
        {score ? (
          <div
            aria-label={`${publication} critic score ${score.display}${band ? `, ${band.label}` : ""}`}
            {...stylex.props(styles.score)}
          >
            <strong {...stylex.props(styles.scoreValue)}>
              {score.display}
            </strong>
            {band ? (
              <span {...stylex.props(styles.band)}>{band.label}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {score && scorePosition ? (
        <div aria-hidden="true" {...stylex.props(styles.scoreRange)}>
          <div {...stylex.props(styles.track)}>
            <span {...stylex.props(styles.tick(scorePosition))} />
          </div>
          <div {...stylex.props(styles.rangeLabels)}>
            <span>0</span>
            <span>{score.scale.toLocaleString("en-US")}</span>
          </div>
        </div>
      ) : null}

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
  score: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-end",
    flexDirection: "column",
    rowGap: space.x1,
  },
  scoreValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  band: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
  },
  scoreRange: {
    marginTop: space.x3,
  },
  track: {
    position: "relative",
    height: "6px",
    borderRadius: "1px",
    backgroundColor: colors.inset,
  },
  tick: (left: string) => ({
    position: "absolute",
    top: "-2px",
    bottom: "-2px",
    left,
    width: "2px",
    borderRadius: "1px",
    backgroundColor: colors.ink,
    transform: "translateX(-1px)",
  }),
  rangeLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "9px",
    lineHeight: 1.2,
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
    color: colors.accentDeep,
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
