import type { ReactNode } from "react";

import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { BottleRatings, type BottleRatingsProps } from "./scoring.stylex";

export type BottleListItem = Omit<BottleIdentityRowProps, "end" | "layout"> & {
  id: string;
  end?: ReactNode;
  ratings?: BottleRatingsProps;
};

export type BottleListProps = {
  ariaLabel: string;
  items: readonly BottleListItem[];
};

/**
 * Catalog list of BottleIdentityRow items. Build items with toBottleListItem;
 * end overrides the optional rating summary. Use CommunityFeed when the author,
 * action, or event grouping matters, and SelectedBottleSummary inside forms.
 */
export function BottleList({ ariaLabel, items }: BottleListProps) {
  return (
    <ItemList ariaLabel={ariaLabel}>
      {items.map(({ end, id, ratings, ...identity }) => (
        <ItemListItem key={id}>
          <BottleIdentityRow
            {...identity}
            end={end ?? (ratings ? <BottleRatings {...ratings} /> : undefined)}
          />
        </ItemListItem>
      ))}
    </ItemList>
  );
}
