"use client";

import type { ReactNode } from "react";

import {
  BottleList,
  type BottleListItem,
} from "@peated/web/components/bottleList.stylex";
import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import {
  FacetGroup,
  type FilterQueryProps,
} from "@peated/web/components/filterPanel.stylex";
import { type ListSortOption } from "@peated/web/components/lists.stylex";
import { Table } from "@peated/web/components/table.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";

export type BottleCatalogListProps = {
  activeFilterCount?: number;
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
  filters?: ReactNode;
  items: readonly BottleListItem[];
  nextHref?: string;
  onClear?: () => void;
  onSortChange: (value: string) => void;
  page: number;
  pending?: boolean;
  previousHref?: string;
  query?: FilterQueryProps;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Presents one API page and an optional API-owned full-result total. */
export function BottleCatalogList({
  activeFilterCount = 0,
  emptyAction,
  emptyDescription = "Try a broader search or remove one of the active filters.",
  emptyHeading = "No bottles found",
  filters,
  items,
  nextHref,
  onClear,
  onSortChange,
  page,
  pending = false,
  previousHref,
  query,
  sort,
  sortOptions,
  total,
}: BottleCatalogListProps) {
  return (
    <Table
      activeFilterCount={activeFilterCount}
      ariaLabel="Bottle catalog"
      count={items.length}
      empty={
        <EmptyState
          action={
            emptyAction ??
            (onClear ? (
              <Button onClick={onClear} size="sm" variant="tonal">
                Clear filters
              </Button>
            ) : (
              <ButtonLink
                href="/addBottle?intent=catalog"
                size="sm"
                variant="tonal"
              >
                Add a bottle
              </ButtonLink>
            ))
          }
          heading={emptyHeading}
        >
          {emptyDescription}
        </EmptyState>
      }
      filters={filters}
      nextHref={nextHref}
      noun="bottle"
      onClear={onClear}
      onSortChange={onSortChange}
      page={page}
      pending={pending}
      previousHref={previousHref}
      query={query}
      sort={sort}
      sortOptions={sortOptions}
      total={total}
    >
      <BottleList ariaLabel="Bottle records" items={items} />
    </Table>
  );
}

export type BottleCatalogFilterOption = {
  label: string;
  value: string;
};

export type BottleCatalogFacetsProps = {
  ageBand: string;
  ageBandOptions: readonly BottleCatalogFilterOption[];
  category: string;
  categoryOptions: readonly BottleCatalogFilterOption[];
  onChange: (name: "ageBand" | "category", value: string) => void;
};

export function BottleCatalogFacets({
  ageBand,
  ageBandOptions,
  category,
  categoryOptions,
  onChange,
}: BottleCatalogFacetsProps) {
  return (
    <>
      <FacetGroup
        label="Category"
        onChange={(value) => onChange("category", value)}
        options={categoryOptions}
        selected={category}
      />
      <FacetGroup
        label="Age statement"
        onChange={(value) => onChange("ageBand", value)}
        options={ageBandOptions}
        selected={ageBand}
      />
    </>
  );
}

export function BottleCatalogLoading() {
  return <CatalogPageLoading title="Bottles" />;
}
