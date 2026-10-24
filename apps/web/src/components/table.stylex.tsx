"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { FilterQuery, type FilterQueryProps } from "./filterPanel.stylex";
import { ListControls } from "./listControls.stylex";
import { CursorPager, ListToolbar, type ListSortOption } from "./lists.stylex";
import { SectionHeading } from "./sectionHeading.stylex";

const NARROW = "@media (max-width: 959px)";

export type TableProps = {
  activeFilterCount?: number;
  ariaLabel: string;
  children: ReactNode;
  count: number;
  empty: ReactNode;
  filters?: ReactNode;
  nextHref?: string;
  noun: string;
  onClear?: () => void;
  onSortChange: (value: string) => void;
  page: number;
  pending?: boolean;
  pluralNoun?: string;
  previousHref?: string;
  query?: FilterQueryProps;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/**
 * Keeps search, filters, sorting, rows, empty results, and paging in one layout.
 * The owning route keeps URL state and loads the records.
 */
export function Table({
  activeFilterCount = 0,
  ariaLabel,
  children,
  count,
  empty,
  filters,
  nextHref,
  noun,
  onClear,
  onSortChange,
  page,
  pending = false,
  pluralNoun = `${noun}s`,
  previousHref,
  query,
  sort,
  sortOptions,
  total,
}: TableProps) {
  const hasControls = Boolean(query || filters);
  const clearAction = activeFilterCount > 0 ? onClear : undefined;
  const mobileAction = hasControls ? (
    <ListControls
      activeFilterCount={activeFilterCount}
      filters={
        filters ? (
          <div
            {...stylex.props(styles.filterGroups, styles.drawerFilterGroups)}
          >
            {filters}
          </div>
        ) : undefined
      }
      onClear={onClear}
      onSortChange={onSortChange}
      pluralNoun={pluralNoun}
      search={query ? <FilterQuery {...query} /> : undefined}
      sort={sort}
      sortOptions={sortOptions}
    />
  ) : undefined;

  return (
    <section aria-label={ariaLabel} {...stylex.props(styles.root)}>
      <div
        {...stylex.props(
          styles.layout,
          filters ? styles.layoutWithFilters : null,
        )}
      >
        <div {...stylex.props(styles.results)}>
          {query ? (
            <div {...stylex.props(styles.wideSearch)}>
              <FilterQuery {...query} />
            </div>
          ) : null}
          <ListToolbar
            count={count}
            mobileAction={mobileAction}
            noun={noun}
            onSortChange={onSortChange}
            pending={pending}
            pluralNoun={pluralNoun}
            sort={sort}
            sortOptions={sortOptions}
            total={total}
          />
          <div aria-busy={pending || undefined}>{count ? children : empty}</div>
          <CursorPager
            ariaLabel={`${noun} pages`}
            nextHref={nextHref}
            page={page}
            previousHref={previousHref}
          />
        </div>
        {filters ? (
          <aside
            aria-label={`${pluralNoun} filters`}
            {...stylex.props(styles.filterRail)}
          >
            <FilterHeading onClear={clearAction} />
            <div {...stylex.props(styles.filterGroups)}>{filters}</div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function FilterHeading({ onClear }: { onClear?: () => void }) {
  return (
    <div {...stylex.props(styles.filterHeading)}>
      <SectionHeading>Filters</SectionHeading>
      {onClear ? (
        <Button onClick={onClear} size="sm" variant="text">
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    minWidth: 0,
  },
  layout: {
    minWidth: 0,
  },
  layoutWithFilters: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    alignItems: "start",
    gap: space.x8,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  results: {
    minWidth: 0,
  },
  wideSearch: {
    marginBottom: space.x4,
    [NARROW]: {
      display: "none",
    },
  },
  filterRail: {
    minWidth: 0,
    [NARROW]: {
      display: "none",
    },
  },
  filterHeading: {
    display: "flex",
    minHeight: "34px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x2,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  filterGroups: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    paddingTop: space.x4,
  },
  drawerFilterGroups: {
    paddingTop: 0,
  },
});
