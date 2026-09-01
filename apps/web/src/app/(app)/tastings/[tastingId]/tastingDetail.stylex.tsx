import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import {
  AppLink,
  Chip,
  MemberAvatar,
  RATING_BANDS,
  TastingMedia,
  TastingRating,
  TastingToastSummary,
  TextLink,
} from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

type Tasting = Outputs["tastings"]["details"];
const COMPACT = "@media (max-width: 639px)";

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** Renders the complete record for one member's pour. */
export function TastingDetail({ tasting }: { tasting: Tasting }) {
  const bottleName = formatBottleDisplayName(tasting.bottle);
  const rating = tasting.ratingBand
    ? RATING_BANDS.find((item) => item.key === tasting.ratingBand)
    : undefined;
  const specs = [
    tasting.servingStyle
      ? {
          label: "Serving",
          value: formatServingStyle(tasting.servingStyle),
        }
      : null,
    tasting.color === null
      ? null
      : { label: "Colour", value: formatColor(tasting.color) },
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <article {...stylex.props(styles.detail)}>
      <header {...stylex.props(styles.authorLine)}>
        <MemberAvatar
          pictureUrl={tasting.createdBy.pictureUrl}
          size="sm"
          username={tasting.createdBy.username}
        />
        <TextLink href={`/users/${tasting.createdBy.username}`}>
          {tasting.createdBy.username}
        </TextLink>
        <span {...stylex.props(styles.date)}>
          <TimeSince date={tasting.createdAt} />
          <span aria-hidden="true"> · </span>
          <time dateTime={tasting.createdAt}>
            {fullDateFormatter.format(new Date(tasting.createdAt))}
          </time>
        </span>
      </header>

      <AppLink
        href={getBottleUrl(tasting.bottle)}
        {...stylex.props(styles.bottleName)}
      >
        {bottleName}
      </AppLink>
      <p {...stylex.props(styles.metadata)}>
        {getBottleMetadata(tasting.bottle)}
      </p>

      <div {...stylex.props(styles.hero)}>
        <TastingMedia
          imageKind={tasting.imageUrl ? "photo" : "bottle"}
          imageUrl={tasting.imageUrl ?? tasting.bottle.imageUrl}
          size="detail"
        />
        <div {...stylex.props(styles.verdict)}>
          <strong {...stylex.props(styles.ratingLabel)}>
            {rating?.label ?? "Not rated"}
          </strong>
          {tasting.ratingBand ? (
            <div {...stylex.props(styles.ratingMark)}>
              <TastingRating band={tasting.ratingBand} />
            </div>
          ) : null}
          {rating ? (
            <span {...stylex.props(styles.ratingRange)}>{rating.range}</span>
          ) : null}
        </div>
      </div>

      <p {...stylex.props(styles.notes, !tasting.notes && styles.emptyNotes)}>
        {tasting.notes || "No notes."}
      </p>

      {tasting.tags.length ? (
        <div {...stylex.props(styles.tags)}>
          {tasting.tags.map((tag, index) => (
            <Chip
              key={`${tag}-${index}`}
              variant={index < 2 ? "tinted" : "neutral"}
            >
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}

      {specs.length ? (
        <dl {...stylex.props(styles.specs)}>
          {specs.map((spec) => (
            <div key={spec.label} {...stylex.props(styles.spec)}>
              <dt {...stylex.props(styles.specLabel)}>{spec.label}</dt>
              <dd {...stylex.props(styles.specValue)}>{spec.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {tasting.friends.length ? (
        <p {...stylex.props(styles.friends)}>
          Poured with{" "}
          {tasting.friends.map((friend, index) => (
            <span key={friend.id}>
              {index > 0
                ? index === tasting.friends.length - 1
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

      <footer {...stylex.props(styles.footer)}>
        <TastingToastSummary
          authorId={tasting.createdBy.id}
          hasToasted={tasting.hasToasted}
          initialCount={tasting.toasts}
          tastingId={tasting.id}
        />
      </footer>
    </article>
  );
}

const styles = stylex.create({
  detail: {
    maxWidth: "760px",
    paddingTop: "20px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  authorLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "10px",
    [COMPACT]: {
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
  },
  date: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  bottleName: {
    display: "block",
    width: "fit-content",
    maxWidth: "100%",
    marginTop: space.x3,
    overflowWrap: "anywhere",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.98,
    textDecoration: "none",
    [COMPACT]: {
      fontSize: "34px",
    },
  },
  metadata: {
    margin: 0,
    marginTop: "10px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    gap: space.x6,
    paddingTop: space.x6,
    [COMPACT]: {
      flexDirection: "column",
      gap: space.x4,
    },
  },
  verdict: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    paddingTop: "2px",
  },
  ratingLabel: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  ratingMark: {
    paddingTop: space.x2,
  },
  ratingRange: {
    marginTop: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
  },
  notes: {
    maxWidth: "58ch",
    margin: 0,
    marginTop: space.x6,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  emptyNotes: {
    color: colors.inkMuted,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: space.x4,
  },
  specs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
    margin: 0,
    marginTop: space.x6,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  spec: {
    minWidth: 0,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
  },
  specLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1.3,
  },
  specValue: {
    margin: 0,
    marginTop: space.x1,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  friends: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
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
