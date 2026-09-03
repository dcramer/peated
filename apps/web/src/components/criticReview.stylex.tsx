import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { Avatar } from "./avatar.stylex";
import { TextLink } from "./textLink.stylex";

export type CriticReviewProps = {
  href?: string;
  publication: string;
  publishedAt?: string;
  nativeScore?: { value: number; scale: number } | null;
  reviewerName?: string;
  summary?: string;
};

/** Shows an attributed critic review with the publication's original score. */
export function CriticReview({
  href,
  publication,
  publishedAt,
  nativeScore,
  reviewerName,
  summary,
}: CriticReviewProps) {
  const byline = reviewerName ? `By ${reviewerName}` : null;
  const hasScore = nativeScore !== null && nativeScore !== undefined;

  return (
    <article {...stylex.props(styles.review)}>
      <header {...stylex.props(styles.source)}>
        <Avatar initials={publication.slice(0, 2).toUpperCase()} size="xs" />
        <div {...stylex.props(foundationStyles.metadata, styles.context)}>
          <strong {...stylex.props(styles.publication)}>{publication}</strong>
          {publishedAt ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{publishedAt}</span>
            </>
          ) : null}
        </div>
      </header>

      {summary || hasScore || byline || href ? (
        <div {...stylex.props(styles.content)}>
          {summary || hasScore ? (
            <div {...stylex.props(styles.body)}>
              {summary ? (
                <p {...stylex.props(foundationStyles.body, styles.summary)}>
                  {summary}
                </p>
              ) : null}
              {hasScore ? (
                <span
                  aria-label={`${publication} score ${nativeScore.value} out of ${nativeScore.scale}`}
                  role="img"
                  {...stylex.props(styles.rating)}
                >
                  {nativeScore.value}
                  <span {...stylex.props(styles.ratingScale)}>
                    /{nativeScore.scale}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {byline || href ? (
            <div {...stylex.props(foundationStyles.metadata, styles.footer)}>
              {byline ? <span>{byline}</span> : null}
              {byline && href ? <span aria-hidden="true"> · </span> : null}
              {href ? (
                <TextLink href={href} size="inherit">
                  Read at {publication} ↗
                </TextLink>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const MOBILE = "@media (max-width: 559px)";
const styles = stylex.create({
  review: {
    width: "100%",
    paddingTop: space.x4,
    paddingBottom: space.x4,
  },
  source: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    [MOBILE]: { gap: space.x2 },
  },
  context: {
    minWidth: 0,
    color: colors.inkMuted,
  },
  publication: {
    color: colors.ink,
  },
  content: {
    minWidth: 0,
    marginTop: space.x2,
    marginLeft: "38px",
    [MOBILE]: { marginLeft: "34px" },
  },
  body: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
  },
  rating: {
    flexShrink: 0,
    marginLeft: "auto",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 1,
    whiteSpace: "nowrap",
    [MOBILE]: { fontSize: "26px" },
  },
  ratingScale: {
    color: colors.inkMuted,
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "normal",
    marginLeft: "3px",
  },
  summary: {
    maxWidth: "54ch",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.ink,
    textWrap: "pretty",
  },
  footer: {
    marginTop: space.x2,
    color: colors.inkMuted,
  },
});
