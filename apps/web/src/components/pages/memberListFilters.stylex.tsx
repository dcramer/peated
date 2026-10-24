"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { Button } from "@peated/web/components/button.stylex";
import {
  FacetGroup,
  FacetGroupLoading,
} from "@peated/web/components/filterPanel.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";

export type MemberListFilter = {
  count?: number;
  label: string;
  selected: boolean;
  value: string;
};

export type MemberListFilterGroup = {
  filters: readonly MemberListFilter[];
  label: string;
  /** The URL parameter the route sets when a filter in this group changes. */
  name: string;
  /** A short fact about the whole group, such as a median, above its rows. */
  summary?: ReactNode;
};

type MemberListFilterGroupsProps = {
  groups: readonly MemberListFilterGroup[];
  onChange: (name: string, value: string) => void;
  /** Every facet bar is measured against this total. */
  total?: number;
};

/**
 * The facet groups for one member's Library or tastings. The rail shows them
 * under search; on narrow screens, ListControls shows them in its drawer.
 */
export function MemberListFilterGroups({
  groups,
  onChange,
  total,
}: MemberListFilterGroupsProps) {
  return (
    <div {...stylex.props(styles.filterContent)}>
      {groups.map((group) => (
        <FacetGroup
          key={group.name}
          label={group.label}
          onChange={(value) => onChange(group.name, value)}
          options={group.filters}
          selected={group.filters.find((filter) => filter.selected)?.value}
          summary={group.summary}
          total={total}
        />
      ))}
    </div>
  );
}

/**
 * Search and facet filters in the rail beside one member's Library or
 * tastings. PageColumns hides the rail on narrow screens, where ListControls
 * takes over. Routes own queries, URL state, and navigation.
 */
export function MemberListFilters({
  onClear,
  query,
  search,
  ...groupProps
}: MemberListFilterGroupsProps & {
  onClear: () => void;
  /** Applied search text, used to offer "Clear filters". */
  query: string;
  /** Search field; the route owns its queries and navigation. */
  search: ReactNode;
}) {
  const hasFilters = Boolean(
    query ||
    groupProps.groups.some((group) =>
      group.filters.some((filter) => filter.selected),
    ),
  );

  return (
    <div {...stylex.props(styles.filterContent)}>
      {search}
      <MemberListFilterGroups {...groupProps} />
      {hasFilters ? (
        <Button onClick={onClear} size="sm" variant="text">
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

export type MemberListFilterGroupLoading = {
  label: string;
  rows: number;
  summary?: boolean;
};

/** Reserves the rail's search field and usual groups while counts load. */
export function MemberListFiltersLoading({
  groups,
  searchLabel,
}: {
  groups: readonly MemberListFilterGroupLoading[];
  searchLabel: string;
}) {
  return (
    <div aria-hidden="true" {...stylex.props(styles.filterContent)}>
      <div {...stylex.props(styles.loadingSearch)}>
        <span {...stylex.props(foundationStyles.fieldLabel)}>
          {searchLabel}
        </span>
        <span {...stylex.props(styles.loadingSearchField)} />
      </div>
      {groups.map((group) => (
        <FacetGroupLoading key={group.label} {...group} />
      ))}
    </div>
  );
}

const styles = stylex.create({
  filterContent: { display: "flex", flexDirection: "column", gap: space.x6 },
  // Matches the route's search field: a label above a full-width field.
  loadingSearch: { display: "flex", flexDirection: "column", gap: space.x2 },
  loadingSearchField: {
    display: "block",
    height: controlMetrics.controlHeight,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
});
