import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { Avatar } from "./avatar.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { Card, CardPrimaryLink } from "./card.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { ReviewScore, TastingRating, type RatingBand } from "./scoring.stylex";
import { TextLink } from "./textLink.stylex";
import TimeSince from "./timeSince";

export type CommunityFeedBottle = Pick<
  BottleIdentityRowProps,
  "provenance" | "href" | "imageFit" | "imageUrl" | "metadata" | "name"
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
              <TextLink href={item.actorHref}>{item.actor}</TextLink>
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
                  <TextLink href={item.destination.href}>
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
                  item.kind === "collection_add" ? "compact" : "activity"
                }
                provenance={bottle.provenance}
                name={bottle.name}
                href={bottle.href}
                imageFit={bottle.imageFit}
                imageUrl={bottle.imageUrl}
                linkArea="title"
                metadata={bottle.metadata}
                verticalPadding="sm"
                activityDetails={
                  bottle.description || bottle.byline ? (
                    <>
                      {bottle.description ? (
                        <p
                          {...stylex.props(
                            foundationStyles.body,
                            styles.excerpt,
                            Boolean(bottle.byline) && styles.excerptWithFooter,
                          )}
                        >
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
                    </>
                  ) : undefined
                }
                end={
                  bottle.score !== undefined || bottle.ratingBand ? (
                    <div {...stylex.props(styles.facts)}>
                      {bottle.score !== undefined ? (
                        <ReviewScore
                          scale={bottle.score.scale}
                          score={bottle.score.value}
                        />
                      ) : null}
                      {bottle.ratingBand ? (
                        <TastingRating band={bottle.ratingBand} />
                      ) : null}
                    </div>
                  ) : undefined
                }
              />
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
    containerType: "inline-size",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    columnGap: { default: space.x3, [MOBILE]: space.x2 },
    width: "calc(100% + 24px)",
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingTop: space.x4,
    paddingRight: "12px",
    paddingBottom: space.x4,
    paddingLeft: "12px",
  },
  author: {
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    alignItems: "center",
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
    display: "flex",
    gridColumn: "2",
    flexDirection: "column",
    gap: space.x3,
    [MOBILE]: { gridColumn: "1 / -1" },
  },
  bottle: { minWidth: 0 },
  compactContent: { gap: 0 },
  facts: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-end",
    flexDirection: "column",
    gap: space.x2,
  },
  excerpt: {
    marginTop: 0,
    marginBottom: 0,
    color: colors.ink,
  },
  excerptWithFooter: { marginBottom: space.x2 },
  footer: { color: colors.inkMuted },
});
