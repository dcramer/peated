"use client";

import { BOTTLE_AGE_BAND_LIST, CATEGORY_LIST } from "@peated/server/constants";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { ButtonLink } from "@peated/web/components";
import { addBottleRowActions } from "@peated/web/components/bottleRowActions.stylex";
import {
  BottleCatalogFilters,
  BottleCatalogList,
  type BottleCatalogFilterOption,
} from "@peated/web/components/pages/bottleCatalog.stylex";
import { CatalogPage } from "@peated/web/components/pages/catalogPage.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import useBottleRowActions from "@peated/web/hooks/useBottleRowActions";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";

import { BottleCatalogNavigation } from "./bottleCatalogNavigation.stylex";

const DEFAULT_SORT = "-release";

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
  ...CATEGORY_LIST.map((value) => ({
    label: formatCategoryName(value),
    value,
  })),
] satisfies readonly BottleCatalogFilterOption[];

const ageBandLabels = {
  nas: "No age statement",
  under_12: "Under 12",
  "12_17": "12–17 years",
  "18_24": "18–24 years",
  "25_plus": "25+ years",
} as const;

const ageBandOptions = BOTTLE_AGE_BAND_LIST.map((value) => ({
  label: ageBandLabels[value],
  value,
})) satisfies readonly BottleCatalogFilterOption[];

const clearedFilterKeys = [
  "age",
  "ageBand",
  "brand",
  "bottler",
  "category",
  "cursor",
  "distiller",
  "entity",
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
  const { user } = useAuth();
  const bottleActions = useBottleRowActions();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayedSearchParams = new URLSearchParams(displayedParams);
  const queryParams = normalizeBottleCatalogQueryParams(
    useApiQueryParams({
      defaults: { sort: DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
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
  const { data: bottleList, isFetching } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort =
    sortOptions.find(
      (option) => option.value === displayedSearchParams.get("sort"),
    )?.value ?? DEFAULT_SORT;
  const filter =
    searchParams.get("filter") === "following" ? "following" : "all";
  const allHref = getScopeHref(pathname, searchParams, "all");
  const followingHref = getScopeHref(pathname, searchParams, "following");

  function navigate(nextParams: URLSearchParams) {
    startTransition(() => {
      // Catalog queries follow the committed URL; only controls anticipate navigation.
      setDisplayedParams(nextParams.toString());
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(displayedParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    });
    if ("ageBand" in updates) nextParams.delete("age");
    if ("age" in updates) nextParams.delete("ageBand");
    nextParams.delete("cursor");
    nextParams.delete("minScore");
    navigate(nextParams);
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(displayedParams);
    clearedFilterKeys.forEach((name) => nextParams.delete(name));
    navigate(nextParams);
  }

  const items = bottleList.results.map((bottle) =>
    addBottleRowActions({
      bottle,
      controls: bottleActions,
      item: toBottleListItem(bottle, {
        includeRatings: true,
        includeRelatedReleases: true,
      }),
    }),
  );
  const title =
    queryParams.series && bottleList.results[0]?.series
      ? bottleList.results[0].series.name
      : "Bottles";
  return (
    <CatalogPage
      action={
        <ButtonLink href="/addBottle?intent=catalog" size="md" variant="tonal">
          Add a bottle
        </ButtonLink>
      }
      filters={
        <BottleCatalogFilters
          age={displayedSearchParams.get("age") ?? ""}
          ageBand={displayedSearchParams.get("ageBand") ?? ""}
          ageBandOptions={ageBandOptions}
          category={displayedSearchParams.get("category") ?? ""}
          categoryOptions={categoryOptions}
          onChange={(name, value) => updateParams({ [name]: value })}
          onClear={clearFilters}
          onQuerySubmit={(value) => updateParams({ query: value.trim() })}
          query={displayedSearchParams.get("query") ?? ""}
        />
      }
      navigation={
        user ? (
          <BottleCatalogNavigation
            allHref={allHref}
            followingHref={followingHref}
            scope={filter}
          />
        ) : undefined
      }
      title={title}
    >
      <BottleCatalogList
        emptyAction={
          filter === "following" && bottleList.followedEntityCount === 0 ? (
            <ButtonLink href="/distillers" size="sm" variant="tonal">
              Browse distillers
            </ButtonLink>
          ) : undefined
        }
        emptyDescription={
          filter === "following" && bottleList.followedEntityCount === 0
            ? "Follow a distiller, brand, or bottler to see its bottles here."
            : undefined
        }
        emptyHeading={
          filter === "following" && bottleList.followedEntityCount === 0
            ? "No bottles here yet"
            : undefined
        }
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.nextCursor,
        )}
        onClear={clearFilters}
        onSortChange={(value) => updateParams({ sort: value })}
        page={page}
        pending={isNavigating || isFetching}
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

function getScopeHref(
  pathname: string,
  searchParams: { toString(): string },
  filter: "all" | "following",
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (filter === "following") nextParams.set("filter", "following");
  else nextParams.delete("filter");
  nextParams.delete("cursor");
  return buildSearchHref(pathname, nextParams);
}
