"use client";

import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../../styles/tokens.stylex";
import {
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterPanel,
  FilterQuery,
  ItemList,
  ItemRow,
  ListToolbar,
  type ListSortOption,
} from "../components";
import { CatalogPageLoading } from "./catalogPage.stylex";

const COMPACT = "@media (max-width: 639px)";

export type EntityCatalogItem = {
  href: string;
  id: string;
  metadata: readonly string[];
  name: string;
  totalBottles: number;
  totalTastings: number;
};

export type EntityCatalogListProps = {
  addHref: string;
  items: readonly EntityCatalogItem[];
  nextHref?: string;
  noun: string;
  onClear?: () => void;
  onSortChange: (value: string) => void;
  page: number;
  previousHref?: string;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
};

/** Presents one API-owned cursor page without inventing a total. */
export function EntityCatalogList({
  addHref,
  items,
  nextHref,
  noun,
  onClear,
  onSortChange,
  page,
  previousHref,
  sort,
  sortOptions,
}: EntityCatalogListProps) {
  return (
    <section aria-label={`${noun} catalog`} {...stylex.props(styles.catalog)}>
      <ListToolbar
        count={items.length}
        noun={noun}
        onSortChange={onSortChange}
        sort={sort}
        sortOptions={sortOptions}
      />
      {items.length ? (
        <ItemList ariaLabel={`${noun} records`} showTopDivider={false}>
          {items.map((item) => (
            <ItemRow
              end={<EntityMeasures item={item} />}
              href={item.href}
              key={item.id}
              metadata={item.metadata.join(" · ")}
              title={item.name}
            />
          ))}
        </ItemList>
      ) : (
        <EmptyState
          action={
            onClear ? (
              <Button onClick={onClear} size="sm" variant="tonal">
                Clear filters
              </Button>
            ) : (
              <ButtonLink href={addHref} size="sm" variant="tonal">
                Add {noun}
              </ButtonLink>
            )
          }
          heading={`No ${noun}s found`}
        >
          Try a broader search or remove the current location filter.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel={`${noun} pages`}
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}

function EntityMeasures({ item }: { item: EntityCatalogItem }) {
  return (
    <span
      aria-label={`${item.totalBottles.toLocaleString("en-US")} bottles and ${item.totalTastings.toLocaleString("en-US")} tastings`}
      {...stylex.props(styles.measures)}
    >
      <span {...stylex.props(styles.measure)}>
        <strong {...stylex.props(styles.measureValue)}>
          {item.totalBottles.toLocaleString("en-US")}
        </strong>
        <span {...stylex.props(styles.measureLabel)}>Bottles</span>
      </span>
      <span {...stylex.props(styles.measure, styles.tastingMeasure)}>
        <strong {...stylex.props(styles.measureValue)}>
          {item.totalTastings.toLocaleString("en-US")}
        </strong>
        <span {...stylex.props(styles.measureLabel)}>Tastings</span>
      </span>
    </span>
  );
}

export type EntityCatalogCountry = {
  label: string;
  value: string;
};

export type EntityCatalogFiltersProps = {
  countries: readonly EntityCatalogCountry[];
  country: string;
  onClear: () => void;
  onCountryChange: (value: string) => void;
  onQuerySubmit: (value: string) => void;
  onRegionClear?: () => void;
  query: string;
  region?: string;
};

/** Keeps query and location filters reachable while the route owns URL state. */
export function EntityCatalogFilters({
  countries,
  country,
  onClear,
  onCountryChange,
  onQuerySubmit,
  onRegionClear,
  query,
  region,
}: EntityCatalogFiltersProps) {
  return (
    <FilterPanel ariaLabel="Entity filters">
      <FilterQuery
        label="Find a record"
        onSubmit={onQuerySubmit}
        placeholder="Name"
        query={query}
      />
      <FacetGroup
        label="Country"
        onChange={onCountryChange}
        options={countries}
        selected={country}
      />
      {region && onRegionClear ? (
        <FacetGroup
          label="Region"
          onChange={onRegionClear}
          options={[{ label: region, value: region }]}
          selected={region}
        />
      ) : null}
      <Button align="start" onClick={onClear} size="sm" variant="text">
        Clear filters
      </Button>
    </FilterPanel>
  );
}

export function EntityCatalogLoading({ title }: { title: string }) {
  return <CatalogPageLoading title={title} />;
}

const styles = stylex.create({
  catalog: {
    minWidth: 0,
  },
  measures: {
    display: "grid",
    width: "156px",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: space.x4,
    [COMPACT]: {
      width: "52px",
      gridTemplateColumns: "52px",
    },
  },
  measure: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: space.x1,
  },
  measureValue: {
    overflow: "hidden",
    maxWidth: "100%",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    textOverflow: "ellipsis",
  },
  measureLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "9px",
    letterSpacing: "0.07em",
    lineHeight: 1.2,
    textTransform: "uppercase",
    [COMPACT]: {
      fontSize: "8px",
    },
  },
  tastingMeasure: {
    [COMPACT]: {
      display: "none",
    },
  },
});
