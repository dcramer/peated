import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { Avatar } from "./avatar.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
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
  activityHref?: string;
  activityLabel?: string;
  byline?: string;
  ratingBand?: RatingBand | null;
  score?: number;
};

export type CommunityFeedItem = {
  id: string;
  kind: "tasting" | "critic_review" | "member_review" | "collection_add";
  actor: string;
  actorHref?: string;
  actorImageUrl?: string | null;
  action: string;
  date: string;
  bottles: readonly CommunityFeedBottle[];
  destination?: { href: string; label: string };
  more?: { href: string; label: string };
};

/**
 * Activity list for the homepage, /activity, and member profiles. Map API entries
 * with getCommunityFeedItems; this component owns author context, event grouping,
 * and the standard/compact bottle choice. Routes own queries, empty states, and actions.
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
    <article {...stylex.props(styles.entry)}>
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
          {item.action}
          {item.destination ? (
            <>
              {" "}
              <TextLink href={item.destination.href} size="inherit">
                {item.destination.label}
              </TextLink>
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
              variant={item.kind === "collection_add" ? "compact" : "standard"}
              provenance={bottle.provenance}
              name={bottle.name}
              href={bottle.href}
              imageUrl={bottle.imageUrl}
              metadata={bottle.metadata}
              end={
                bottle.score !== undefined || bottle.ratingBand ? (
                  <div {...stylex.props(styles.facts)}>
                    {bottle.score !== undefined ? (
                      <strong
                        aria-label={`Review score: ${bottle.score} out of 100`}
                        {...stylex.props(styles.score)}
                      >
                        {bottle.score}
                        <span {...stylex.props(styles.scoreScale)}>/100</span>
                      </strong>
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
            {bottle.description || bottle.activityHref || bottle.byline ? (
              <div {...stylex.props(styles.details)}>
                {bottle.description ? (
                  <p {...stylex.props(foundationStyles.body, styles.excerpt)}>
                    {bottle.description}
                  </p>
                ) : null}
                {bottle.byline || bottle.activityHref ? (
                  <div
                    {...stylex.props(foundationStyles.metadata, styles.footer)}
                  >
                    {bottle.byline ? <span>By {bottle.byline}</span> : null}
                    {bottle.byline && bottle.activityHref ? (
                      <span aria-hidden="true"> · </span>
                    ) : null}
                    {bottle.activityHref ? (
                      <TextLink href={bottle.activityHref} size="inherit">
                        {bottle.activityLabel}
                      </TextLink>
                    ) : null}
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
    </article>
  );
}

const MOBILE = "@media (max-width: 559px)";
const styles = stylex.create({
  entry: { paddingTop: space.x4, paddingBottom: space.x4 },
  author: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    [MOBILE]: { gap: space.x2 },
  },
  context: { minWidth: 0, color: colors.inkMuted },
  date: { whiteSpace: "nowrap" },
  content: {
    minWidth: 0,
    marginLeft: "38px",
    marginTop: space.x2,
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
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "normal",
    marginLeft: "3px",
  },
  excerpt: {
    marginTop: 0,
    marginBottom: space.x2,
    color: colors.ink,
    fontStyle: "italic",
  },
  footer: { color: colors.inkMuted },
});
