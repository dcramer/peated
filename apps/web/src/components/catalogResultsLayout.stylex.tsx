"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../styles/tokens.stylex";
import {
  FilterQuery,
  FilterRail,
  type FilterQueryProps,
} from "./filterPanel.stylex";
import { ListControls } from "./listControls.stylex";
import { CursorPager, ListToolbar, type ListSortOption } from "./lists.stylex";
import { PageColumns } from "./pages/pageLayout.stylex";

export type CatalogResultsLayoutProps = {
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
 * Search and filters sit in a FilterRail beside the results, as on member
 * Tastings and Library; narrow screens move them into the Filters drawer.
 * The owning route keeps URL state and loads the records.
 */
export function CatalogResultsLayout({
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
}: CatalogResultsLayoutProps) {
  const hasControls = Boolean(query || filters);
  const clearAction =
    activeFilterCount > 0 || query?.query ? onClear : undefined;
  const results = (
    <section aria-label={ariaLabel} {...stylex.props(styles.results)}>
      <ListToolbar
        count={count}
        mobileAction={
          hasControls ? (
            <ListControls
              activeFilterCount={activeFilterCount}
              filters={
                filters ? (
                  <div {...stylex.props(styles.filterGroups)}>{filters}</div>
                ) : undefined
              }
              onClear={onClear}
              onSortChange={onSortChange}
              pluralNoun={pluralNoun}
              search={query ? <FilterQuery {...query} /> : undefined}
              sort={sort}
              sortOptions={sortOptions}
            />
          ) : undefined
        }
        noun={noun}
        // An empty result offers its own Clear filters.
        onClear={count ? clearAction : undefined}
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
    </section>
  );

  if (!hasControls) return results;

  return (
    <PageColumns
      rail={
        <FilterRail
          ariaLabel={`${pluralNoun} filters`}
          search={query ? <FilterQuery {...query} /> : undefined}
        >
          {filters}
        </FilterRail>
      }
    >
      {results}
    </PageColumns>
  );
}

const styles = stylex.create({
  results: {
    minWidth: 0,
  },
  filterGroups: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
  },
});
