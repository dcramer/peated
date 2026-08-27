"use client";

import { CATEGORY_LIST } from "@peated/server/constants";
import { formatCategoryName } from "@peated/server/lib/format";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import useApiQueryParams from "../../../hooks/useApiQueryParams";
import { getBottleExpressionName } from "../../../lib/bottleLabel";
import { useORPC } from "../../../lib/orpc/context";
import { getReleaseFamilyHref } from "../../../lib/releaseFamily";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, space } from "../../../styles/tokens.stylex";
import { ButtonLink } from "../components";
import {
  BottleCatalogFilters,
  BottleCatalogList,
  type BottleCatalogFacetGroup,
  type BottleCatalogFilterOption,
  type BottleCatalogItem,
} from "../patterns/bottleCatalog.stylex";

const NARROW = "@media (max-width: 759px)";
const DEFAULT_SORT = "-tastings";

const sortOptions = [
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Best verdict", value: "-rating" },
  { label: "Recently added", value: "-created" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
] as const;

const categoryOptions = [
  { label: "All categories", value: "" },
  ...CATEGORY_LIST.map((value) => ({
    label: formatCategoryName(value),
    value,
  })),
] satisfies readonly BottleCatalogFilterOption[];

const facetGroups = [
  {
    label: "Category",
    name: "category",
    options: CATEGORY_LIST.map((value) => ({
      label: formatCategoryName(value),
      value,
    })),
  },
] satisfies readonly BottleCatalogFacetGroup[];

const clearedFilterKeys = [
  "age",
  "brand",
  "bottler",
  "category",
  "cursor",
  "distiller",
  "entity",
  "filter",
  "flavorProfile",
  "flight",
  "minRating",
  "minScore",
  "query",
  "series",
  "tag",
] as const;

export function BottleListController() {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParams = useApiQueryParams({
    numericFields: [
      "age",
      "brand",
      "bottler",
      "cursor",
      "distiller",
      "entity",
      "limit",
      "series",
    ],
    overrides: { limit: 50, minRating: null, minScore: null },
  });
  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({ input: queryParams }),
  );
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    nextParams.delete("cursor");
    nextParams.delete("minRating");
    nextParams.delete("minScore");
    router.push(buildHref(pathname, nextParams));
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    clearedFilterKeys.forEach((name) => nextParams.delete(name));
    router.push(buildHref(pathname, nextParams));
  }

  const items = bottleList.results.map(toCatalogItem);

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.titleRow)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Whisky database</div>
          <h1 {...stylex.props(foundationStyles.pageTitle)}>Bottles</h1>
        </div>
        <ButtonLink href="/addBottle" size="md" variant="tonal">
          Record a bottle
        </ButtonLink>
      </header>
      <div {...stylex.props(styles.layout)}>
        <div {...stylex.props(styles.results)}>
          <BottleCatalogList
            items={items}
            nextHref={getCursorHref(
              pathname,
              searchParams,
              bottleList.rel.nextCursor,
            )}
            onClear={clearFilters}
            onSortChange={(value) => updateParams({ sort: value })}
            page={page}
            previousHref={getCursorHref(
              pathname,
              searchParams,
              bottleList.rel.prevCursor,
            )}
            sort={sort}
            sortOptions={sortOptions}
          />
        </div>
        <aside {...stylex.props(styles.filters)}>
          <BottleCatalogFilters
            age={searchParams.get("age") ?? ""}
            category={searchParams.get("category") ?? ""}
            categoryOptions={categoryOptions}
            facets={{
              groups: facetGroups,
              onChange: (name, value) => updateParams({ [name]: value }),
              selected: {
                category: searchParams.get("category") ?? "",
              },
            }}
            key={searchParams.get("query") ?? ""}
            onChange={(name, value) => updateParams({ [name]: value })}
            onClear={clearFilters}
            onQuerySubmit={(value) => updateParams({ query: value.trim() })}
            query={searchParams.get("query") ?? ""}
          />
        </aside>
      </div>
    </div>
  );
}

function toCatalogItem(bottle: {
  abv: number | null;
  avgScore: number | null;
  brand: { id: number; name: string };
  category: (typeof CATEGORY_LIST)[number] | null;
  group?: { name: string; totalBottles: number };
  hasTasted: boolean;
  id: number;
  imageUrl: string | null;
  isLibrary: boolean;
  name: string;
  noAgeStatement: boolean | null;
  peatedId: string;
  ratingStats: { pass: number; savor: number; sip: number };
  statedAge: number | null;
  totalScores: number;
  totalTastings: number;
}): BottleCatalogItem {
  const metadata = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
        : null,
    bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
    `${bottle.totalTastings.toLocaleString("en-US")} ${bottle.totalTastings === 1 ? "tasting" : "tastings"}`,
  ].filter((value): value is string => value !== null);
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    averageScore: bottle.avgScore,
    brand: bottle.brand.name,
    brandHref: `/entities/${bottle.brand.id}`,
    hasTasted: bottle.hasTasted,
    href: `/bottles/${bottle.id}`,
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
    metadata,
    name: bottle.group?.name ?? getBottleExpressionName(bottle),
    relatedReleases:
      relatedReleaseCount > 1
        ? {
            count: relatedReleaseCount,
            href: getReleaseFamilyHref(bottle.id),
          }
        : undefined,
    totalScores: bottle.totalScores,
    verdicts: bottle.ratingStats,
  };
}

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}

function getCursorHref(
  pathname: string,
  searchParams: URLSearchParams,
  cursor: number | null,
) {
  if (cursor === null) return undefined;

  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("cursor", String(cursor));
  nextParams.delete("minRating");
  nextParams.delete("minScore");
  return buildHref(pathname, nextParams);
}

function buildHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.x4,
    marginBottom: space.x6,
    [NARROW]: {
      alignItems: "flex-start",
    },
  },
  eyebrow: {
    marginBottom: space.x1,
    color: colors.inkMuted,
    fontFamily: "IBM Plex Mono, monospace",
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  layout: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    alignItems: "start",
    gap: space.x8,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  results: {
    minWidth: 0,
  },
  filters: {
    minWidth: 0,
    [NARROW]: {
      gridRow: 1,
    },
  },
});
