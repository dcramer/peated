"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useId } from "react";

import {
  BottleIdentityRow,
  BottleRatings,
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterPanel,
  FilterQuery,
  ListToolbar,
  Select,
  TextInput,
  type ListSortOption,
  type TastingRatingCounts,
} from "..";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";
import { CatalogTable, type CatalogTableColumn } from "./catalogTable.stylex";

const NARROW = "@media (max-width: 759px)";

export type BottleCatalogItem = {
  bandCounts: TastingRatingCounts;
  brand: string;
  brandHref?: string;
  hasTasted?: boolean;
  href: string;
  id: string;
  imageUrl?: string | null;
  isLibrary?: boolean;
  metadata: readonly string[];
  name: string;
  relatedReleases?: {
    count: number;
    href: string;
  };
  medianScore: number | null;
  scoreHigh: number | null;
  scoreLow: number | null;
  scoreCount: number;
  totalTastings: number;
};

export type BottleCatalogListProps = {
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
  items: readonly BottleCatalogItem[];
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
          <BottleCatalogTable items={items} />
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

function BottleCatalogTable({
  items,
}: {
  items: readonly BottleCatalogItem[];
}) {
  const columns: CatalogTableColumn<BottleCatalogItem>[] = [
    {
      cell: (item) => (
        <BottleIdentityRow
          brand={item.brand}
          brandHref={item.brandHref}
          hasTasted={item.hasTasted}
          href={item.href}
          imageUrl={item.imageUrl}
          isLibrary={item.isLibrary}
          layout="cell"
          metadata={item.metadata}
          name={item.name}
          relatedReleases={item.relatedReleases}
        />
      ),
      header: "Bottle",
      key: "bottle",
      padding: "flush",
    },
    {
      align: "right",
      cell: (item) => item.totalTastings.toLocaleString("en-US"),
      header: "Tastings",
      key: "tastings",
      width: "count",
    },
    {
      align: "right",
      cell: (item) => (
        <BottleRatings
          counts={item.bandCounts}
          high={item.scoreHigh}
          low={item.scoreLow}
          median={item.medianScore}
          scoreCount={item.scoreCount}
        />
      ),
      header: "Rating",
      key: "rating",
      padding: "flush",
      width: "rating",
    },
  ];

  return (
    <CatalogTable
      caption="Bottle records"
      columns={columns}
      getKey={(item) => item.id}
      items={items}
      linked
    />
  );
}

export type BottleCatalogFilterOption = {
  label: string;
  value: string;
};

export type BottleCatalogFacetName = "ageBand" | "category";

export type BottleCatalogFacetGroup = {
  label: string;
  name: BottleCatalogFacetName;
  options: readonly {
    count?: number;
    label: string;
    value: string;
  }[];
};

export type BottleCatalogFacetsProps = {
  groups: readonly BottleCatalogFacetGroup[];
  onChange: (name: BottleCatalogFacetName, value: string) => void;
  selected: Partial<Record<BottleCatalogFacetName, string>>;
  total?: number;
};

/** Renders API-owned catalog facets without deriving counts from a cursor page. */
export function BottleCatalogFacets({
  groups,
  onChange,
  selected,
  total,
}: BottleCatalogFacetsProps) {
  return (
    <div {...stylex.props(styles.facetGroups)}>
      {groups.map((group) => (
        <FacetGroup
          key={group.name}
          label={group.label}
          onChange={(value) => onChange(group.name, value)}
          options={group.options}
          selected={selected[group.name]}
          total={total}
        />
      ))}
    </div>
  );
}

export type BottleCatalogFiltersProps = {
  age: string;
  category: string;
  categoryOptions: readonly BottleCatalogFilterOption[];
  facets?: BottleCatalogFacetsProps;
  onChange: (name: "age" | "category", value: string) => void;
  onClear: () => void;
  onQuerySubmit: (value: string) => void;
  query: string;
};

/** Keeps catalog filters reachable while the product route owns URL state. */
export function BottleCatalogFilters({
  age,
  category,
  categoryOptions,
  facets,
  onChange,
  onClear,
  onQuerySubmit,
  query,
}: BottleCatalogFiltersProps) {
  const id = useId();
  const facetNames = new Set(facets?.groups.map((group) => group.name));

  return (
    <FilterPanel ariaLabel="Bottle filters">
      <FilterQuery
        label="Find a bottle"
        onSubmit={onQuerySubmit}
        placeholder="Name, brand, or release"
        query={query}
      />
      {facetNames.has("category") ? null : (
        <FilterSelect
          label="Category"
          onChange={(value) => onChange("category", value)}
          options={categoryOptions}
          value={category}
        />
      )}
      {facets ? <BottleCatalogFacets {...facets} /> : null}
      {facetNames.has("ageBand") ? null : (
        <label htmlFor={`${id}-age`} {...stylex.props(styles.field)}>
          <span {...stylex.props(styles.filterHeading)}>Age statement</span>
          <TextInput
            aria-label="Age statement in years"
            id={`${id}-age`}
            inputMode="numeric"
            min={0}
            onChange={(event) => onChange("age", event.currentTarget.value)}
            placeholder="Any age"
            type="number"
            value={age}
          />
        </label>
      )}
      <Button align="start" onClick={onClear} size="sm" variant="text">
        Clear filters
      </Button>
    </FilterPanel>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly BottleCatalogFilterOption[];
  value: string;
}) {
  const id = useId();

  return (
    <label htmlFor={id} {...stylex.props(styles.field)}>
      <span {...stylex.props(styles.filterHeading)}>{label}</span>
      <Select
        aria-label={label}
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function BottleCatalogLoading() {
  return <CatalogPageLoading title="Bottles" />;
}

const styles = stylex.create({
  catalog: {
    minWidth: 0,
  },
  field: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x2,
  },
  filterHeading: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  facetGroups: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x6,
    [NARROW]: {
      gridColumn: "1 / -1",
    },
  },
});
