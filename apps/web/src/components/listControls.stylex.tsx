"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import { useState, type ReactNode } from "react";

import { colors, controlMetrics, space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { ListSort, type ListSortOption } from "./lists.stylex";
import { Slideout } from "./slideout.stylex";

export type ListControlsProps = {
  activeFilterCount?: number;
  /** Filter groups, laid out by the caller. */
  filters?: ReactNode;
  /** Clears every filter; shown in the drawer footer when filters are active. */
  onClear?: () => void;
  onSortChange: (value: string) => void;
  pluralNoun: string;
  /** Search field shown above the sort. */
  search?: ReactNode;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
};

/**
 * The narrow-screen "Filters" button and the drawer it opens with search, sort,
 * and filters. Pass it to ListToolbar as `mobileAction`; the toolbar shows it
 * where the page's filter rail collapses. Routes own URL state and queries.
 */
export function ListControls({
  activeFilterCount = 0,
  filters,
  onClear,
  onSortChange,
  pluralNoun,
  search,
  sort,
  sortOptions,
}: ListControlsProps) {
  const [open, setOpen] = useState(false);
  const clearAction = activeFilterCount > 0 ? onClear : undefined;
  const label = activeFilterCount
    ? `Search, filters, and sort, ${activeFilterCount} active ${
        activeFilterCount === 1 ? "filter" : "filters"
      }`
    : "Search, filters, and sort";

  return (
    <>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen(true)}
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
      <Slideout
        footer={
          <div {...stylex.props(styles.footerActions)}>
            {clearAction ? (
              <Button onClick={clearAction} size="md" variant="text">
                Clear filters
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)} size="md" variant="accent">
              View results
            </Button>
          </div>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Search, filters, and sort"
      >
        <div {...stylex.props(styles.drawerControls)}>
          {search}
          <ListSort
            fullWidth
            noun={pluralNoun}
            onChange={onSortChange}
            options={sortOptions}
            value={sort}
          />
          {filters ? <section aria-label="Filters">{filters}</section> : null}
        </div>
      </Slideout>
    </>
  );
}

const styles = stylex.create({
  activeCount: {
    minWidth: "18px",
    height: "18px",
    paddingRight: "5px",
    paddingLeft: "5px",
    // DESIGN.md: counts use the 2px chip radius, never a pill.
    borderRadius: controlMetrics.radiusSmall,
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
  footerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
  },
});
