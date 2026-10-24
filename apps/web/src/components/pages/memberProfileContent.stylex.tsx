"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "@peated/web/components/bottleIdentityRow.stylex";
import { Chip } from "@peated/web/components/chip.stylex";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import { ItemList, ItemListItem } from "@peated/web/components/itemList.stylex";
import {
  CursorPager,
  ListToolbar,
  type ListSortOption,
} from "@peated/web/components/lists.stylex";
import {
  RowMenu,
  type RowMenuGroup,
} from "@peated/web/components/rowMenu.stylex";
import { space } from "../../styles/tokens.stylex";

export type MemberLibraryItem = BottleIdentityRowProps & {
  actions?: readonly RowMenuGroup[];
  id: string;
  status?: string;
};

export type MemberLibraryListProps = {
  emptyAction?: ReactNode;
  emptyDescription: ReactNode;
  emptyHeading: string;
  items: readonly MemberLibraryItem[];
  nextHref?: string;
  onSortChange: (value: string) => void;
  pending?: boolean;
  page: number;
  previousHref?: string;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Presents one member Library page without personal-state marks that the view already implies. */
export function MemberLibraryList({
  emptyAction,
  emptyDescription,
  emptyHeading,
  items,
  nextHref,
  onSortChange,
  pending = false,
  page,
  previousHref,
  sort,
  sortOptions,
  total,
}: MemberLibraryListProps) {
  return (
    <section aria-label="Member library" {...stylex.props(styles.library)}>
      <ListToolbar
        count={items.length}
        noun="bottle"
        onSortChange={onSortChange}
        pending={pending}
        sort={sort}
        sortOptions={sortOptions}
        total={total}
      />
      <div aria-busy={pending || undefined}>
        {items.length ? (
          <ItemList ariaLabel="Library bottles">
            {items.map(({ actions, id, status, ...identity }) => (
              <ItemListItem key={id}>
                <BottleIdentityRow
                  {...identity}
                  end={
                    status || actions?.length ? (
                      <div {...stylex.props(styles.libraryEnd)}>
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
        ) : (
          <EmptyState action={emptyAction} heading={emptyHeading}>
            {emptyDescription}
          </EmptyState>
        )}
      </div>
      <CursorPager
        ariaLabel="Library pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}

const styles = stylex.create({
  library: { minWidth: 0 },
  libraryEnd: { display: "flex", alignItems: "center", gap: space.x2 },
});
