"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { Button } from "@peated/web/components/button.stylex";
import { FacetGroup } from "@peated/web/components/filterPanel.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

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

/**
 * Search and facet filters for one member's Library or tastings. Rail mode sits
 * beside the list; mobile mode collapses the same content under `mobileLabel`.
 * Facet bars share `total`. Routes own queries, URL state, and navigation.
 */
export function MemberListFilters({
  groups,
  mobileLabel,
  mode,
  onChange,
  onClear,
  query,
  search,
  total,
}: {
  groups: readonly MemberListFilterGroup[];
  /** Mobile summary text, such as "Filter library". */
  mobileLabel: string;
  mode: "mobile" | "rail";
  onChange: (name: string, value: string) => void;
  onClear: () => void;
  /** Applied search text, used to offer "Clear filters". */
  query: string;
  /** Search field; the route owns its queries and navigation. */
  search: ReactNode;
  total?: number;
}) {
  const hasFilters = Boolean(
    query ||
    groups.some((group) => group.filters.some((filter) => filter.selected)),
  );
  const content = (
    <div {...stylex.props(styles.filterContent)}>
      {search}
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
      {hasFilters ? (
        <Button onClick={onClear} size="sm" variant="text">
          Clear filters
        </Button>
      ) : null}
    </div>
  );

  return mode === "mobile" ? (
    <details {...stylex.props(styles.mobileFilters)}>
      <summary
        {...stylex.props(
          foundationStyles.interactiveSmall,
          styles.mobileSummary,
        )}
      >
        {mobileLabel}
      </summary>
      {content}
    </details>
  ) : (
    <div {...stylex.props(styles.railFilters)}>{content}</div>
  );
}

const styles = stylex.create({
  filterContent: { display: "flex", flexDirection: "column", gap: space.x6 },
  railFilters: { display: "block", [NARROW]: { display: "none" } },
  mobileFilters: {
    display: "none",
    marginBottom: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
    [NARROW]: { display: "block" },
  },
  mobileSummary: {
    padding: space.x3,
    color: colors.ink,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
