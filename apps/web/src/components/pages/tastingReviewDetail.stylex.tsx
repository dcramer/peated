import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  AppLink,
  Chip,
  FactList,
  MemberAvatar,
  RATING_BANDS,
  TastingRating,
  TextLink,
  type RatingBand,
} from "@peated/web/components";
import { getBottleUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, fonts, space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";

type Bottle = Outputs["tastings"]["details"]["bottle"];
type Member = Outputs["tastings"]["details"]["createdBy"];
type ServingStyle = Outputs["tastings"]["details"]["servingStyle"];

type Rating =
  | { kind: "review"; score: number }
  | { kind: "tasting"; ratingBand: RatingBand | null };

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
export function TastingReviewDetail({
  author,
  bottle,
  color,
  createdAt,
  footer,
  friends,
  notes,
  rating,
  servingStyle,
  tags,
}: {
  author: Member;
  bottle: Bottle;
  color: number | null;
  createdAt: string;
  footer?: ReactNode;
  friends: readonly Member[];
  notes?: string | null;
  rating: Rating;
  servingStyle?: ServingStyle;
  tags: readonly string[];
}) {
  const bottleName = formatBottleDisplayName(bottle);
  const bottleTitle = bottleName.replaceAll(" - ", "\u00a0- ");
  const ratingBand =
    rating.kind === "tasting" && rating.ratingBand
      ? RATING_BANDS.find((item) => item.key === rating.ratingBand)
      : undefined;
  const facts = [
    servingStyle
      ? { label: "Serving", value: formatServingStyle(servingStyle) }
      : null,
    color === null ? null : { label: "Colour", value: formatColor(color) },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <article {...stylex.props(styles.detail)}>
      <PageHeader
        metadata={`${rating.kind === "review" ? "Review" : "Tasting"} · ${fullDateFormatter.format(new Date(createdAt))}`}
        title={
          <AppLink
            aria-label={bottleName}
            href={getBottleUrl(bottle)}
            {...stylex.props(styles.titleLink)}
          >
            {bottleTitle}
          </AppLink>
        }
      />

      <div {...stylex.props(styles.body)}>
        <header {...stylex.props(styles.recordHeader)}>
          <div {...stylex.props(styles.authorLine)}>
            <MemberAvatar
              pictureUrl={author.pictureUrl}
              size="sm"
              username={author.username}
            />
            <div {...stylex.props(styles.authorCopy)}>
              <TextLink href={`/users/${author.username}`}>
                {author.username}
              </TextLink>
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.authorMetadata,
                )}
              >
                {rating.kind === "review" ? "Member review" : "Tasting note"}
              </span>
            </div>
          </div>

          {rating.kind === "review" ? (
            <div {...stylex.props(styles.reviewScore)}>
              <strong {...stylex.props(styles.reviewScoreValue)}>
                {rating.score}
              </strong>
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.reviewScoreScale,
                )}
              >
                /100
              </span>
            </div>
          ) : rating.ratingBand && ratingBand ? (
            <div {...stylex.props(styles.tastingRatingSummary)}>
              <TastingRating band={rating.ratingBand} />
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.tastingRatingCaption,
                )}
              >
                {ratingBand.label} · {ratingBand.range}
              </span>
            </div>
          ) : (
            <span {...stylex.props(foundationStyles.metadata, styles.unrated)}>
              Not rated
            </span>
          )}
        </header>

        {facts.length ? (
          <div {...stylex.props(styles.facts)}>
            <FactList facts={facts} layout="grid" />
          </div>
        ) : null}

        {notes ? <RecordNotes notes={notes} /> : null}

        {tags.length ? (
          <div {...stylex.props(styles.tags)}>
            {tags.map((tag, index) => (
              <Chip
                key={`${tag}-${index}`}
                variant={index < 2 ? "tinted" : "neutral"}
              >
                {tag}
              </Chip>
            ))}
          </div>
        ) : null}

        {friends.length ? (
          <p {...stylex.props(foundationStyles.metadata, styles.friends)}>
            {rating.kind === "review" ? "Shared with " : "Poured with "}
            {friends.map((friend, index) => (
              <span key={friend.id}>
                {index > 0
                  ? index === friends.length - 1
                    ? " and "
                    : ", "
                  : null}
                <TextLink href={`/users/${friend.username}`} size="inherit">
                  {friend.username}
                </TextLink>
              </span>
            ))}
          </p>
        ) : null}

        {footer ? (
          <footer {...stylex.props(styles.footer)}>{footer}</footer>
        ) : null}
      </div>
    </article>
  );
}

function RecordNotes({ notes }: { notes: string }) {
  const paragraphs = notes.split(/\n\s*\n/).filter(Boolean);

  return (
    <div {...stylex.props(foundationStyles.prose, styles.recordNotes)}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          {...stylex.props(
            styles.noteParagraph,
            index === paragraphs.length - 1 && styles.lastNoteParagraph,
          )}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

const styles = stylex.create({
  detail: {
    minWidth: 0,
  },
  titleLink: {
    display: "inline-block",
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
    },
    textDecoration: "none",
    textWrap: "balance",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  body: {
    paddingTop: "20px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  recordHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
  },
  authorLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
  },
  authorCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: "2px",
  },
  authorMetadata: {
    color: colors.inkMuted,
  },
  reviewScore: {
    display: "flex",
    flexShrink: 0,
    alignItems: "baseline",
    color: colors.ink,
    fontFamily: fonts.display,
  },
  reviewScoreValue: {
    fontSize: "40px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  reviewScoreScale: {
    color: colors.inkMuted,
  },
  tastingRatingSummary: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: space.x1,
  },
  tastingRatingCaption: {
    color: colors.inkMuted,
  },
  unrated: {
    flexShrink: 0,
    color: colors.inkMuted,
  },
  facts: {
    minWidth: 0,
    marginTop: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  recordNotes: {
    maxWidth: "62ch",
    marginTop: space.x6,
    color: colors.ink,
  },

  noteParagraph: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: space.x4,
    marginLeft: 0,
    whiteSpace: "pre-line",
  },
  lastNoteParagraph: {
    marginBottom: 0,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: space.x4,
  },
  friends: {
    margin: 0,
    marginTop: space.x4,
    color: colors.inkMuted,
  },
  footer: {
    display: "flex",
    marginTop: space.x6,
    paddingTop: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
});
