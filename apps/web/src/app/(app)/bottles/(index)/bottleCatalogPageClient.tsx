"use client";

import { CATEGORY_LIST } from "@peated/server/constants";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ButtonLink } from "@peated/web/components/designSystem/components";
import {
  BottleCatalogFilters,
  BottleCatalogList,
  type BottleCatalogFacetGroup,
  type BottleCatalogFilterOption,
} from "@peated/web/components/designSystem/patterns/bottleCatalog.stylex";
import { CatalogPage } from "@peated/web/components/designSystem/patterns/catalogPage.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { toBottleCatalogItem } from "@peated/web/lib/bottleCatalogItem";
import { normalizeBottleCatalogQueryParams } from "@peated/web/lib/bottleCatalogQueryParams";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";

const DEFAULT_SORT = "-tastings";

type BottleList = Outputs["bottles"]["list"];

const sortOptions = [
  { label: "Most tasted", value: "-tastings" },
  { label: "Latest release", value: "-release" },
  { label: "Highest score", value: "-score" },
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

const ageBandLabels = {
  nas: "NAS",
  under_12: "Under 12",
  "12_17": "12–17 years",
  "18_24": "18–24 years",
  "25_plus": "25+ years",
} as const;

const clearedFilterKeys = [
  "age",
  "ageBand",
  "brand",
  "bottler",
  "category",
  "cursor",
  "distiller",
  "entity",
  "filter",
  "flavorProfile",
  "flight",
  "minScore",
  "query",
  "series",
  "tag",
] as const;

export function BottleCatalogPageClient({
  initialBottleList,
}: {
  initialBottleList: BottleList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParams = normalizeBottleCatalogQueryParams(
    useApiQueryParams({
      numericFields: [
        "age",
        "brand",
        "bottler",
        "cursor",
        "distiller",
        "entity",
        "limit",
        "minScore",
        "series",
      ],
      overrides: { limit: 50 },
    }),
  );
  const { data: bottleList } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    if ("ageBand" in updates) nextParams.delete("age");
    if ("age" in updates) nextParams.delete("ageBand");
    nextParams.delete("cursor");
    nextParams.delete("minScore");
    router.push(buildSearchHref(pathname, nextParams));
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    clearedFilterKeys.forEach((name) => nextParams.delete(name));
    router.push(buildSearchHref(pathname, nextParams));
  }

  const items = bottleList.results.map(toBottleCatalogItem);
  const facetGroups = [
    {
      label: "Category",
      name: "category",
      options: bottleList.facets.category.map(({ count, value }) => ({
        count,
        label: formatCategoryName(value),
        value,
      })),
    },
    {
      label: "Age statement",
      name: "ageBand",
      options: bottleList.facets.ageBand.map(({ count, value }) => ({
        count,
        label: ageBandLabels[value],
        value,
      })),
    },
  ] satisfies readonly BottleCatalogFacetGroup[];

  return (
    <CatalogPage
      action={
        <ButtonLink href="/addBottle?intent=catalog" size="md" variant="tonal">
          Add a bottle
        </ButtonLink>
      }
      filters={
        <BottleCatalogFilters
          age={searchParams.get("age") ?? ""}
          category={searchParams.get("category") ?? ""}
          categoryOptions={categoryOptions}
          facets={{
            groups: facetGroups,
            onChange: (name, value) => updateParams({ [name]: value }),
            selected: {
              ageBand: searchParams.get("ageBand") ?? "",
              category: searchParams.get("category") ?? "",
            },
            total: bottleList.total,
          }}
          key={searchParams.get("query") ?? ""}
          onChange={(name, value) => updateParams({ [name]: value })}
          onClear={clearFilters}
          onQuerySubmit={(value) => updateParams({ query: value.trim() })}
          query={searchParams.get("query") ?? ""}
        />
      }
      title="Bottles"
    >
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
        total={bottleList.total}
      />
    </CatalogPage>
  );
}
