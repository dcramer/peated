"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  BottleList,
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterPanel,
  ListToolbar,
  type BottleListItem,
  type ListSortOption,
} from "..";
import { CatalogPageLoading } from "./catalogPage.stylex";

export type BottleCatalogListProps = {
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
  items: readonly BottleListItem[];
  nextHref?: string;
  onClear?: () => void;
  onSortChange: (value: string) => void;
  page: number;
  previousHref?: string;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Presents one API page and an optional API-owned full-result total. */
export function BottleCatalogList({
  emptyAction,
  emptyDescription = "Try a broader search or remove one of the active filters.",
  emptyHeading = "No bottles found",
  items,
  nextHref,
  onClear,
  onSortChange,
  page,
  previousHref,
  sort,
  sortOptions,
  total,
}: BottleCatalogListProps) {
  return (
    <section aria-label="Bottle catalog" {...stylex.props(styles.catalog)}>
      {items.length ? (
        <>
          <ListToolbar
            count={items.length}
            noun="bottle"
            onSortChange={onSortChange}
            sort={sort}
            sortOptions={sortOptions}
            total={total}
          />
          <BottleList ariaLabel="Bottle records" items={items} />
        </>
      ) : (
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
      )}
      <CursorPager
        ariaLabel="Bottle pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}

export type BottleCatalogFilterOption = {
  label: string;
  value: string;
};

export type BottleCatalogFiltersProps = {
  age: string;
  ageBand: string;
  ageBandOptions: readonly BottleCatalogFilterOption[];
  category: string;
  categoryOptions: readonly BottleCatalogFilterOption[];
  onChange: (name: "ageBand" | "category", value: string) => void;
  onClear: () => void;
  onQuerySubmit: (value: string) => void;
  query: string;
};

/** Keeps catalog filters reachable while the product route owns URL state. */
export function BottleCatalogFilters({
  age,
  ageBand,
  ageBandOptions,
  category,
  categoryOptions,
  onChange,
  onClear,
  onQuerySubmit,
  query,
}: BottleCatalogFiltersProps) {
  const hasFilters = Boolean(age || ageBand || category || query);

  return (
    <FilterPanel
      ariaLabel="Bottle filters"
      onClear={hasFilters ? onClear : undefined}
      query={{
        label: "Find a bottle",
        onSubmit: onQuerySubmit,
        placeholder: "Name, brand, or release",
        query,
      }}
    >
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
    </FilterPanel>
  );
}

export function BottleCatalogLoading() {
  return <CatalogPageLoading title="Bottles" />;
}

const styles = stylex.create({
  catalog: {
    minWidth: 0,
  },
});
