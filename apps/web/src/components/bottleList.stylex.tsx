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

/** Owns the standard bottle-list structure and delegates identity to one row. */
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
