"use client";

import * as stylex from "@stylexjs/stylex";

import { space } from "../styles/tokens.stylex";
import {
  BottleIdentityRow,
  BottleIdentityRowLoading,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { Chip } from "./chip.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { RowMenu, type RowMenuGroup } from "./rowMenu.stylex";

/** One Library Bottle, for both LibraryList and LibraryTable. */
export type LibraryItem = BottleIdentityRowProps & {
  /** Row menu for the member who owns the Library. */
  actions?: readonly RowMenuGroup[];
  /** Category, producers, and release facts on one line, for LibraryTable. */
  facts?: string;
  id: string;
  /** Open, Sealed, or Empty; omitted when the member has not set one. */
  status?: string;
};

export type LibraryListProps = {
  ariaLabel: string;
  items: readonly LibraryItem[];
};

/**
 * One member's Library Bottles as standard bottle rows, each with its status
 * and, for the owner, a row menu. It leaves out the in-Library mark, which
 * every row would repeat. Map API entries with getLibraryItem. Routes own
 * queries, empty states, and paging.
 */
export function LibraryList({ ariaLabel, items }: LibraryListProps) {
  return (
    <ItemList ariaLabel={ariaLabel}>
      {items.map(({ actions, facts: _facts, id, status, ...identity }) => (
        <ItemListItem key={id}>
          <BottleIdentityRow
            {...identity}
            end={
              status || actions?.length ? (
                <div {...stylex.props(styles.end)}>
                  {status ? <Chip>{status}</Chip> : null}
                  {actions?.length ? (
                    <RowMenu groups={actions} label={identity.name} />
                  ) : null}
                </div>
              ) : undefined
            }
          />
        </ItemListItem>
      ))}
    </ItemList>
  );
}

/** Reserves Library rows at their finished size while they load. */
export function LibraryListLoading({
  label = "Loading library bottles",
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <div aria-hidden="true">
        <ItemList ariaLabel={label}>
          {Array.from({ length: rows }, (_, index) => (
            <ItemListItem key={index}>
              <BottleIdentityRowLoading />
            </ItemListItem>
          ))}
        </ItemList>
      </div>
    </div>
  );
}

const styles = stylex.create({
  end: { display: "flex", alignItems: "center", gap: space.x2 },
});
