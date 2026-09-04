import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { Avatar } from "./avatar.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { Card, CardPrimaryLink } from "./card.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { RATING_BANDS, TastingRating, type RatingBand } from "./scoring.stylex";
import { TextLink } from "./textLink.stylex";
import TimeSince from "./timeSince";

export type CommunityFeedBottle = Pick<
  BottleIdentityRowProps,
  "provenance" | "href" | "imageUrl" | "metadata" | "name"
> & {
  id: string;
  description?: string;
  byline?: string;
  ratingBand?: RatingBand | null;
  score?: { value: number; scale: number };
};

export type CommunityFeedItem = {
  id: string;
  kind: "tasting" | "critic_review" | "member_review" | "collection_add";
  actor: string;
  actorHref?: string;
  actorImageUrl?: string | null;
  action: string;
  date: string;
  href?: string;
  bottles: readonly CommunityFeedBottle[];
  destination?: { href: string; label: string };
  more?: { href: string; label: string };
};

/**
 * Activity and full-width tasting list shared by the homepage, activity, bottle,
 * brand or producer, and member pages. Map API entries with getCommunityFeedItems
 * or getTastingFeedItems. Routes own queries, empty states, and actions.
 */
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
          <CommunityFeedEntry item={item} />
        </ItemListItem>
      ))}
    </ItemList>
  );
}

function CommunityFeedEntry({ item }: { item: CommunityFeedItem }) {
  return (
    <article>
      <Card
        appearance="plain"
        linked={Boolean(item.href)}
        padding="none"
        {...stylex.props(styles.entry)}
      >
        <header {...stylex.props(styles.author)}>
          <Avatar
            imageUrl={item.actorImageUrl}
            initials={item.actor.slice(0, 2).toUpperCase()}
            size="xs"
          />
          <div {...stylex.props(foundationStyles.metadata, styles.context)}>
            {item.actorHref ? (
              <TextLink href={item.actorHref} size="inherit">
                {item.actor}
              </TextLink>
            ) : (
              <strong>{item.actor}</strong>
            )}{" "}
            {item.href && !item.destination ? (
              <CardPrimaryLink
                aria-label={getActivityLinkLabel(item)}
                href={item.href}
                {...stylex.props(styles.activityLink)}
              >
                {item.action}
              </CardPrimaryLink>
            ) : (
              item.action
            )}
            {item.destination ? (
              <>
                {" "}
                {item.href === item.destination.href ? (
                  <CardPrimaryLink
                    aria-label={getActivityLinkLabel(item)}
                    href={item.href}
                    {...stylex.props(styles.activityLink)}
                  >
                    {item.destination.label}
                  </CardPrimaryLink>
                ) : (
                  <TextLink href={item.destination.href} size="inherit">
                    {item.destination.label}
                  </TextLink>
                )}
              </>
            ) : null}
            <span {...stylex.props(styles.date)}>
              <span aria-hidden="true"> · </span>
              <TimeSince date={item.date} />
            </span>
          </div>
        </header>
        <div
          {...stylex.props(
            styles.content,
            item.kind === "collection_add" && styles.compactContent,
          )}
        >
          {item.bottles.map((bottle) => (
            <div key={bottle.id} {...stylex.props(styles.bottle)}>
              <BottleIdentityRow
                variant={
                  item.kind === "collection_add" ? "compact" : "standard"
                }
                provenance={bottle.provenance}
                name={bottle.name}
                href={bottle.href}
                imageUrl={bottle.imageUrl}
                linkArea="title"
                metadata={bottle.metadata}
                verticalPadding="sm"
                end={
                  bottle.score !== undefined || bottle.ratingBand ? (
                    <div {...stylex.props(styles.facts)}>
                      {bottle.score !== undefined ? (
                        <span
                          role="img"
                          aria-label={`Review score: ${bottle.score.value} out of ${bottle.score.scale}`}
                          {...stylex.props(styles.score)}
                        >
                          {bottle.score.value}
                          <span {...stylex.props(styles.scoreScale)}>
                            /{bottle.score.scale}
                          </span>
                        </span>
                      ) : null}
                      {bottle.ratingBand ? (
                        <>
                          <strong {...stylex.props(styles.rating)}>
                            {
                              RATING_BANDS.find(
                                (band) => band.key === bottle.ratingBand,
                              )?.label
                            }
                          </strong>
                          <TastingRating band={bottle.ratingBand} />
                        </>
                      ) : null}
                    </div>
                  ) : undefined
                }
              />
              {bottle.description || bottle.byline ? (
                <div {...stylex.props(styles.details)}>
                  {bottle.description ? (
                    <p {...stylex.props(foundationStyles.body, styles.excerpt)}>
                      {bottle.description}
                    </p>
                  ) : null}
                  {bottle.byline ? (
                    <div
                      {...stylex.props(
                        foundationStyles.metadata,
                        styles.footer,
                      )}
                    >
                      By {bottle.byline}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {item.more ? (
            <TextLink href={item.more.href} size="sm">
              {item.more.label}
            </TextLink>
          ) : null}
        </div>
      </Card>
    </article>
  );
}

function getActivityLinkLabel(item: CommunityFeedItem) {
  const bottle = item.bottles[0];
  if (item.kind === "tasting" && bottle) {
    return `View tasting of ${bottle.name} by ${item.actor}`;
  }
  if (item.kind === "critic_review" && bottle) {
    return `Read review of ${bottle.name} from ${item.actor}`;
  }
  if (item.kind === "member_review" && bottle) {
    return `Read review of ${bottle.name} by ${item.actor}`;
  }
  return item.destination ? `View ${item.destination.label}` : item.action;
}

const MOBILE = "@media (max-width: 559px)";
const styles = stylex.create({
  entry: {
    width: "calc(100% + 24px)",
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingTop: space.x4,
    paddingRight: "12px",
    paddingBottom: space.x4,
    paddingLeft: "12px",
  },
  author: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    [MOBILE]: { gap: space.x2 },
  },
  context: { minWidth: 0, color: colors.inkMuted },
  activityLink: {
    display: "inline",
    color: "inherit",
    fontWeight: "inherit",
    textDecoration: "none",
  },
  date: { whiteSpace: "nowrap" },
  content: {
    minWidth: 0,
    marginLeft: "38px",
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    [MOBILE]: { marginLeft: "34px" },
  },
  bottle: { minWidth: 0 },
  compactContent: { gap: 0 },
  details: {
    marginLeft: "60px",
    ["@media (max-width: 639px)"]: { marginLeft: "54px" },
  },
  facts: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-end",
    flexDirection: "column",
    gap: space.x2,
  },
  rating: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "right",
    [MOBILE]: { fontSize: "13px" },
  },
  score: {
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
  scoreScale: {
    color: colors.inkMuted,
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: "normal",
    marginLeft: "3px",
  },
  excerpt: {
    marginTop: 0,
    marginBottom: space.x2,
    color: colors.ink,
  },
  footer: { color: colors.inkMuted },
});
