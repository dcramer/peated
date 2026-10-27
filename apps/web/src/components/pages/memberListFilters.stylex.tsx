"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  FacetGroup,
  FilterRail,
} from "@peated/web/components/filterPanel.stylex";
import { space } from "../../styles/tokens.stylex";

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
  search,
  ...groupProps
}: MemberListFilterGroupsProps & {
  /** Search field; the route owns its queries and navigation. */
  search: ReactNode;
}) {
  return (
    <FilterRail search={search}>
      <MemberListFilterGroups {...groupProps} />
    </FilterRail>
  );
}

const styles = stylex.create({
  filterContent: { display: "flex", flexDirection: "column", gap: space.x6 },
});
