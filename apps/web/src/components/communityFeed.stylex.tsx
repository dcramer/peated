import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../styles/tokens.stylex";
import { BottleVisual } from "./bottleIdentityRow.stylex";
import { ItemList, ItemRow } from "./itemList.stylex";
import TimeSince from "./timeSince";

export type CommunityFeedItem = {
  date: string;
  description?: string;
  href: string;
  id: string;
  imageUrl?: string | null;
  label: string;
  metadata?: string;
  rating?: string;
  title: string;
};

export function CommunityFeed({
  ariaLabel = "Community",
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
        <ItemRow
          align="start"
          description={item.description}
          end={
            <span {...stylex.props(styles.facts)}>
              {item.rating ? (
                <strong {...stylex.props(styles.rating)}>{item.rating}</strong>
              ) : null}
              <span {...stylex.props(styles.date)}>
                <TimeSince date={item.date} />
              </span>
            </span>
          }
          href={item.href}
          key={item.id}
          leading={<BottleVisual imageUrl={item.imageUrl} size="sm" />}
          metadata={item.metadata}
          metadataWrap
          subtitle={item.label}
          title={item.title}
        />
      ))}
    </ItemList>
  );
}

const MOBILE = "@media (max-width: 559px)";

const styles = stylex.create({
  facts: {
    display: "flex",
    minWidth: "84px",
    alignItems: "flex-end",
    flexDirection: "column",
    gap: space.x1,
    [MOBILE]: {
      minWidth: "auto",
    },
  },
  rating: {
    maxWidth: "120px",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "right",
    [MOBILE]: {
      maxWidth: "72px",
      fontSize: "12px",
    },
  },
  date: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
    textAlign: "right",
    whiteSpace: "nowrap",
    [MOBILE]: {
      display: "none",
    },
  },
});
