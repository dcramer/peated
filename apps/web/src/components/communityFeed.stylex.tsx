import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../styles/tokens.stylex";
import { AppLink, isInternalAppHref } from "./appLink";
import { BottleVisual } from "./bottleIdentityRow.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";
import { RATING_BANDS, TastingRating, type RatingBand } from "./scoring.stylex";
import { TextLink } from "./textLink.stylex";
import TimeSince from "./timeSince";

export type CommunityFeedItem = {
  actor: string;
  actorHref?: string;
  bottleHref: string;
  date: string;
  description?: string;
  href: string;
  id: string;
  imageUrl?: string | null;
  metadata?: string;
  ratingBand?: RatingBand | null;
  score?: number;
  title: string;
};

/** Centers ratings beside bottle identity, with the excerpt below and independent bottle links. */
export function CommunityFeed({
  ariaLabel = "Activity",
  items,
  limit,
}: {
  ariaLabel?: string;
  items: readonly CommunityFeedItem[];
  limit?: number;
}) {
  const visibleItems = limit === undefined ? items : items.slice(0, limit);

  return (
    <ItemList ariaLabel={ariaLabel}>
      {visibleItems.map((item) => (
        <ItemListItem key={item.id}>
          <article
            {...stylex.props(
              styles.entry,
              linkedRowStyles.container,
              linkedRowStyles.onGround,
            )}
          >
            <BottleVisual imageUrl={item.imageUrl} size="sm" />
            <div {...stylex.props(styles.heading)}>
              <div {...stylex.props(styles.identity)}>
                <AppLink
                  href={item.href}
                  title={item.title}
                  {...stylex.props(styles.title, linkedRowStyles.primaryLink)}
                >
                  {item.title}
                </AppLink>
                <div {...stylex.props(styles.context)}>
                  {item.actorHref ? (
                    <TextLink href={item.actorHref} size="inherit">
                      {item.actor}
                    </TextLink>
                  ) : (
                    item.actor
                  )}
                  {!isInternalAppHref(item.href) ? (
                    <span aria-hidden="true"> ↗</span>
                  ) : null}
                  <span aria-hidden="true"> · </span>
                  <TimeSince date={item.date} />
                </div>
                <div {...stylex.props(styles.metadata)}>
                  {item.metadata ? <>{item.metadata} · </> : null}
                  <TextLink href={item.bottleHref} size="inherit">
                    View bottle
                  </TextLink>
                </div>
              </div>
              {item.score !== undefined || item.ratingBand ? (
                <div {...stylex.props(styles.facts)}>
                  {item.score !== undefined ? (
                    <strong
                      aria-label={`Review score: ${item.score} out of 100`}
                      {...stylex.props(styles.score)}
                    >
                      {item.score}
                    </strong>
                  ) : null}
                  {item.ratingBand ? (
                    <>
                      <strong {...stylex.props(styles.rating)}>
                        {
                          RATING_BANDS.find(
                            (band) => band.key === item.ratingBand,
                          )?.label
                        }
                      </strong>
                      <TastingRating band={item.ratingBand} />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            {item.description ? (
              <p {...stylex.props(styles.excerpt)}>{item.description}</p>
            ) : null}
          </article>
        </ItemListItem>
      ))}
    </ItemList>
  );
}

const MOBILE = "@media (max-width: 559px)";

const styles = stylex.create({
  entry: {
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr)",
    alignItems: "center",
    columnGap: space.x3,
    rowGap: space.x2,
    width: "calc(100% + 24px)",
    marginLeft: "-12px",
    marginRight: "-12px",
    padding: "14px 12px",
  },
  heading: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    display: "block",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.25,
    textDecoration: "none",
    whiteSpace: "normal",
    textWrap: "pretty",
  },
  context: {
    marginTop: "3px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.3,
  },
  metadata: {
    marginTop: "3px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  facts: {
    display: "flex",
    maxWidth: "112px",
    flexShrink: 0,
    alignItems: "flex-end",
    flexDirection: "column",
    gap: space.x2,
  },
  rating: {
    maxWidth: "120px",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "right",
    [MOBILE]: {
      maxWidth: "88px",
      fontSize: "15px",
    },
  },
  score: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
    textAlign: "right",
  },
  excerpt: {
    gridColumn: "2",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontStyle: "italic",
    lineHeight: 1.6,
  },
});
