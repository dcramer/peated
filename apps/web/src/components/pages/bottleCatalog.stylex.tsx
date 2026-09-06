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
  FilterQuery,
  ListToolbar,
  type BottleListItem,
  type ListSortOption,
} from "..";
import { space } from "../../styles/tokens.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";

const NARROW = "@media (max-width: 759px)";

export type BottleCatalogListProps = {
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
  items: readonly BottleListItem[];
  nextHref?: string;
  onClear?: () => void;
  onSortChange: (value: string) => void;
  page: number;
  pending?: boolean;
  previousHref?: string;
  search?: ReactNode;
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
  pending = false,
  previousHref,
  search,
  sort,
  sortOptions,
  total,
}: BottleCatalogListProps) {
  return (
    <section aria-label="Bottle catalog" {...stylex.props(styles.catalog)}>
      {search}
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
          <BottleList ariaLabel="Bottle records" items={items} />
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
      </div>
      <CursorPager
        ariaLabel="Bottle pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}

/** Keeps bottle-name search primary on wide catalog layouts. */
export function BottleCatalogSearch({
  onSubmit,
  query,
}: {
  onSubmit: (value: string) => void;
  query: string;
}) {
  return (
    <div {...stylex.props(styles.desktopSearch)}>
      <FilterQuery
        label="Find a bottle"
        onSubmit={onSubmit}
        placeholder="Name, brand, or release"
        query={query}
      />
    </div>
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
      queryVisibility="narrow"
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
  desktopSearch: {
    marginBottom: space.x4,
    [NARROW]: {
      display: "none",
    },
  },
});
