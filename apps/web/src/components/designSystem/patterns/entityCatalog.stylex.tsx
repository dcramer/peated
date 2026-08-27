"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import type { FormEvent } from "react";
import { useId, useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetRow,
  ListToolbar,
  LoadingRecordList,
  TextInput,
  type ListSortOption,
} from "../components";
import { RecordList, RecordRow } from "./pagePatternShell.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 759px)";

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
        <RecordList ariaLabel={`${noun} records`}>
          {items.map((item) => (
            <RecordRow
              end={<EntityMeasures item={item} />}
              href={item.href}
              key={item.id}
              metadata={item.metadata.join(" · ")}
              title={item.name}
            />
          ))}
        </RecordList>
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
  const id = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(query);

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onQuerySubmit(queryDraft.trim());
  }

  return (
    <section aria-label="Entity filters" {...stylex.props(styles.filters)}>
      <button
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
        type="button"
        {...stylex.props(styles.filterToggle)}
      >
        <ListFilter aria-hidden="true" size={16} strokeWidth={1.75} />
        Filters
      </button>
      <div
        {...stylex.props(
          styles.filterContent,
          mobileOpen && styles.filterContentOpen,
        )}
      >
        <form onSubmit={submitQuery} {...stylex.props(styles.queryForm)}>
          <label htmlFor={`${id}-query`} {...stylex.props(styles.field)}>
            <span {...stylex.props(styles.filterHeading)}>Find a record</span>
            <TextInput
              aria-label="Find a record"
              id={`${id}-query`}
              onChange={(event) => setQueryDraft(event.currentTarget.value)}
              placeholder="Name"
              value={queryDraft}
            />
          </label>
          <Button size="sm" type="submit" variant="tonal">
            Search
          </Button>
        </form>
        <section aria-labelledby={`${id}-country`}>
          <h3 id={`${id}-country`} {...stylex.props(styles.filterHeading)}>
            Country
          </h3>
          <div {...stylex.props(styles.facetRows)}>
            {countries.map((option) => (
              <FacetRow
                key={option.value}
                label={option.label}
                onClick={() =>
                  onCountryChange(country === option.value ? "" : option.value)
                }
                selected={country === option.value}
              />
            ))}
          </div>
        </section>
        {region && onRegionClear ? (
          <section aria-labelledby={`${id}-region`}>
            <h3 id={`${id}-region`} {...stylex.props(styles.filterHeading)}>
              Region
            </h3>
            <div {...stylex.props(styles.facetRows)}>
              <FacetRow label={region} onClick={onRegionClear} selected />
            </div>
          </section>
        ) : null}
        <Button
          align="start"
          onClick={() => {
            setQueryDraft("");
            onClear();
          }}
          size="sm"
          variant="text"
        >
          Clear filters
        </Button>
      </div>
    </section>
  );
}

export function EntityCatalogLoading({ title }: { title: string }) {
  return (
    <section aria-label={`${title} catalog`} {...stylex.props(styles.catalog)}>
      <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
      <div {...stylex.props(styles.loading)}>
        <LoadingRecordList label={`Loading ${title.toLowerCase()}`} rows={4} />
      </div>
    </section>
  );
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
  filters: {
    minWidth: 0,
  },
  filterToggle: {
    display: "none",
    width: "100%",
    height: controlMetrics.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    [NARROW]: {
      display: "flex",
    },
  },
  filterContent: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    [NARROW]: {
      display: "none",
      paddingTop: space.x4,
    },
  },
  filterContentOpen: {
    [NARROW]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  queryForm: {
    display: "flex",
    alignItems: "flex-end",
    gap: space.x2,
    [NARROW]: {
      gridColumn: "1 / -1",
    },
  },
  field: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x2,
  },
  filterHeading: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  facetRows: {
    marginTop: space.x2,
    paddingTop: space.x1,
    paddingRight: space.x1,
    paddingBottom: space.x1,
    paddingLeft: space.x1,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loading: {
    marginTop: space.x6,
  },
});
