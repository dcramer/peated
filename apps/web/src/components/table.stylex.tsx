"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import { useState, type ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { FilterQuery, type FilterQueryProps } from "./filterPanel.stylex";
import {
  CursorPager,
  ListSort,
  ListToolbar,
  type ListSortOption,
} from "./lists.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { Slideout } from "./slideout.stylex";

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
  const [controlsOpen, setControlsOpen] = useState(false);
  const hasControls = Boolean(query || filters);
  const clearAction = activeFilterCount > 0 ? onClear : undefined;
  const controlsLabel = activeFilterCount
    ? `Search, filters, and sort, ${activeFilterCount} active ${
        activeFilterCount === 1 ? "filter" : "filters"
      }`
    : "Search, filters, and sort";

  const mobileAction = hasControls ? (
    <Button
      aria-expanded={controlsOpen}
      aria-haspopup="dialog"
      aria-label={controlsLabel}
      onClick={() => setControlsOpen(true)}
      size="sm"
      variant="tonal"
    >
      <ListFilter aria-hidden="true" size={16} strokeWidth={1.75} />
      Filters
      {activeFilterCount ? (
        <span aria-hidden="true" {...stylex.props(styles.activeCount)}>
          {activeFilterCount}
        </span>
      ) : null}
    </Button>
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
      {hasControls ? (
        <Slideout
          footer={
            <div {...stylex.props(styles.footerActions)}>
              {clearAction ? (
                <Button onClick={clearAction} size="md" variant="text">
                  Clear filters
                </Button>
              ) : null}
              <Button
                onClick={() => setControlsOpen(false)}
                size="md"
                variant="accent"
              >
                Done
              </Button>
            </div>
          }
          onClose={() => setControlsOpen(false)}
          open={controlsOpen}
          title="Search, filters, and sort"
        >
          <div {...stylex.props(styles.drawerControls)}>
            {query ? <FilterQuery {...query} /> : null}
            <ListSort
              fullWidth
              noun={pluralNoun}
              onChange={onSortChange}
              options={sortOptions}
              value={sort}
            />
            <p {...stylex.props(foundationStyles.metadata, styles.liveNote)}>
              Changes apply as you make them.
            </p>
            {filters ? (
              <section aria-label="Filters">
                <FilterHeading onClear={clearAction} />
                <div {...stylex.props(styles.filterGroups)}>{filters}</div>
              </section>
            ) : null}
          </div>
        </Slideout>
      ) : null}
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
  activeCount: {
    minWidth: "18px",
    height: "18px",
    paddingRight: "5px",
    paddingLeft: "5px",
    borderRadius: "999px",
    backgroundColor: colors.accent,
    color: colors.ground,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "18px",
    textAlign: "center",
  },
  drawerControls: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x6,
  },
  liveNote: {
    margin: 0,
    color: colors.inkMuted,
  },
  footerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
  },
});
