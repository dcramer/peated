"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
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
  BottleIdentityRow,
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetRow,
  ListToolbar,
  LoadingList,
  Select,
  TextInput,
  VerdictDistributionBar,
  type ListSortOption,
} from "../components";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 759px)";

export type BottleCatalogItem = {
  averageScore: number | null;
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
  totalScores: number;
  verdicts: {
    pass: number;
    savor: number;
    sip: number;
  };
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
      <ListToolbar
        count={items.length}
        noun="bottle"
        onSortChange={onSortChange}
        sort={sort}
        sortOptions={sortOptions}
        total={total}
      />
      {items.length ? (
        <ul {...stylex.props(styles.list)}>
          {items.map((item) => (
            <li key={item.id} {...stylex.props(styles.listItem)}>
              <BottleIdentityRow
                brand={item.brand}
                brandHref={item.brandHref}
                end={<BottleCatalogMeasures item={item} />}
                hasTasted={item.hasTasted}
                href={item.href}
                imageUrl={item.imageUrl}
                isLibrary={item.isLibrary}
                metadata={item.metadata}
                name={item.name}
                relatedReleases={item.relatedReleases}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          action={
            emptyAction ??
            (onClear ? (
              <Button onClick={onClear} size="sm" variant="tonal">
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/addBottle" size="sm" variant="tonal">
                Record a bottle
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

function BottleCatalogMeasures({ item }: { item: BottleCatalogItem }) {
  const score =
    item.averageScore === null ? "–" : formatScore(item.averageScore);

  return (
    <div {...stylex.props(styles.measures)}>
      <span
        aria-label={
          item.averageScore === null
            ? "No community score"
            : `Community score ${item.averageScore.toFixed(1)} from ${item.totalScores} ${item.totalScores === 1 ? "score" : "scores"}`
        }
        {...stylex.props(styles.measure)}
      >
        <span {...stylex.props(styles.measureLabel)}>Score</span>
        <strong {...stylex.props(styles.score)}>{score}</strong>
      </span>
      <span {...stylex.props(styles.measure, styles.verdictMeasure)}>
        <span {...stylex.props(styles.measureLabel)}>Verdict</span>
        <VerdictDistributionBar {...item.verdicts} />
      </span>
    </div>
  );
}

function formatScore(score: number) {
  return score.toFixed(1).replace(/\.0$/, "");
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
  const id = useId();

  return (
    <div {...stylex.props(styles.facetGroups)}>
      {groups.map((group) => (
        <section
          aria-labelledby={`${id}-${group.name}`}
          key={group.name}
          {...stylex.props(styles.facetGroup)}
        >
          <h3
            id={`${id}-${group.name}`}
            {...stylex.props(styles.filterHeading)}
          >
            {group.label}
          </h3>
          <div {...stylex.props(styles.facetRows)}>
            {group.options.map((option) => {
              const isSelected = selected[group.name] === option.value;
              const rowProps = {
                label: option.label,
                onClick: () =>
                  onChange(group.name, isSelected ? "" : option.value),
                selected: isSelected,
              };

              return option.count === undefined || total === undefined ? (
                <FacetRow {...rowProps} key={option.value} />
              ) : (
                <FacetRow
                  {...rowProps}
                  count={option.count}
                  key={option.value}
                  total={total}
                />
              );
            })}
          </div>
        </section>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(query);
  const facetNames = new Set(facets?.groups.map((group) => group.name));

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onQuerySubmit(queryDraft);
  }

  return (
    <section aria-label="Bottle filters" {...stylex.props(styles.filters)}>
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
            <span {...stylex.props(styles.filterHeading)}>Find a bottle</span>
            <TextInput
              aria-label="Find a bottle"
              id={`${id}-query`}
              onChange={(event) => setQueryDraft(event.currentTarget.value)}
              placeholder="Name, brand, or release"
              value={queryDraft}
            />
          </label>
          <Button size="sm" type="submit" variant="tonal">
            Search
          </Button>
        </form>
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
  return (
    <section aria-label="Bottle catalog" {...stylex.props(styles.catalog)}>
      <h1 {...stylex.props(foundationStyles.pageTitle)}>Bottles</h1>
      <div {...stylex.props(styles.loading)}>
        <LoadingList label="Loading bottles" rows={4} />
      </div>
    </section>
  );
}

const styles = stylex.create({
  catalog: {
    minWidth: 0,
  },
  list: {
    display: "flex",
    margin: 0,
    padding: 0,
    flexDirection: "column",
    listStyle: "none",
  },
  listItem: {
    minWidth: 0,
  },
  measures: {
    display: "grid",
    width: "168px",
    gridTemplateColumns: "64px 80px",
    alignItems: "center",
    gap: space.x3,
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
  verdictMeasure: {
    [COMPACT]: {
      display: "none",
    },
  },
  measureLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "9px",
    letterSpacing: "0.07em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  score: {
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
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
  facetGroup: {
    minWidth: 0,
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
