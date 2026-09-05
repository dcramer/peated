import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  Chip,
  FactList,
  MemberAvatar,
  ReviewScore,
  TastingRating,
  TextLink,
  type RatingBand,
} from "@peated/web/components";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";
import { TastingReviewBottleSummary } from "./tastingReviewBottleSummary.stylex";

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
  menu,
  notes,
  photoUrl,
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
  menu?: ReactNode;
  notes?: string | null;
  photoUrl?: string | null;
  rating: Rating;
  servingStyle?: ServingStyle;
  tags: readonly string[];
}) {
  const bottleName = formatBottleDisplayName(bottle);
  const bottleTitle = bottleName.replaceAll(" - ", "\u00a0- ");
  const metadata = `${rating.kind === "review" ? "Review" : "Tasting"} · ${fullDateFormatter.format(new Date(createdAt))}`;
  const facts = [
    servingStyle
      ? { label: "Serving", value: formatServingStyle(servingStyle) }
      : null,
    color === null ? null : { label: "Colour", value: formatColor(color) },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <article {...stylex.props(styles.detail)}>
      <PageHeader
        metadata={
          menu ? (
            <div {...stylex.props(styles.metadataRow)}>
              <span>{metadata}</span>
              {menu}
            </div>
          ) : (
            metadata
          )
        }
        title={bottleTitle}
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
            <ReviewScore score={rating.score} size="lg" />
          ) : rating.ratingBand ? (
            <TastingRating band={rating.ratingBand} size="lg" />
          ) : (
            <span {...stylex.props(foundationStyles.metadata, styles.unrated)}>
              Not rated
            </span>
          )}
        </header>

        <TastingReviewBottleSummary
          bottle={bottle}
          photoUrl={photoUrl}
          placement="mobile"
        />

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
                <TextLink href={`/users/${friend.username}`}>
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
  body: {
    paddingTop: space.x4,
  },
  metadataRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.x3,
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
  unrated: {
    flexShrink: 0,
    color: colors.inkMuted,
  },
  facts: {
    minWidth: 0,
    marginTop: space.x3,
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
