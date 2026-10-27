"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";

import { FacetGroup } from "@peated/web/components/filterPanel.stylex";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

import { getDistilleryBottleView } from "../entityPageData";

const DEFAULT_SORT = "-release";

type BottleList = Outputs["bottles"]["list"];

const sortOptions = [
  { label: "Newest release", value: "-release" },
  { label: "Most reviewed", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Brand and bottle", value: "brand" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
] as const;

export function EntityBottleListClient({
  emptyAction,
  entityId,
  entityKind,
  entityName,
  initialDistilleryView,
  initialBottleList,
}: {
  emptyAction: ReactNode;
  entityId: number;
  entityKind: "brand" | "bottler" | "company" | "distillery";
  entityName: string;
  initialDistilleryView?: "other" | "releases";
  initialBottleList: BottleList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayedSearchParams = new URLSearchParams(displayedParams);
  const distilleryView = getDistilleryBottleView(
    { kind: entityKind },
    searchParams.get("view") ?? undefined,
    initialDistilleryView,
  );
  const displayedView = getDistilleryBottleView(
    { kind: entityKind },
    displayedSearchParams.get("view") ?? undefined,
    initialDistilleryView,
  );
  const queryParams = normalizeBottleCatalogQueryParams(
    useApiQueryParams({
      defaults: { sort: DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
      numericFields: [
        "age",
        "brand",
        "bottler",
        "company",
        "cursor",
        "distiller",
        "entity",
        "limit",
        "series",
      ],
      overrides: {
        company: entityKind === "company" ? entityId : undefined,
        distilleryView,
        entity: entityKind === "company" ? undefined : entityId,
        limit: 25,
      },
    }),
  );
  const { data: bottleList, isFetching } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = displayedSearchParams.get("sort") ?? DEFAULT_SORT;
  const query = displayedSearchParams.get("query") ?? "";
  // Empty results describe the search the list actually ran.
  const searchedQuery = searchParams.get("query") ?? "";

  function navigate(nextParams: URLSearchParams) {
    nextParams.delete("cursor");
    // The server picks Other bottlings for a distillery without releases only
    // when nothing narrows the list, so a search must carry the shown view.
    if (displayedView && !nextParams.has("view")) {
      nextParams.set("view", displayedView);
    }
    startTransition(() => {
      setDisplayedParams(nextParams.toString());
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(displayedSearchParams);
    nextParams.set("sort", value);
    navigate(nextParams);
  }

  function updateQuery(value: string) {
    const nextParams = new URLSearchParams(displayedSearchParams);
    if (value) nextParams.set("query", value);
    else nextParams.delete("query");
    navigate(nextParams);
  }

  function updateView(value: string) {
    const nextParams = new URLSearchParams(displayedSearchParams);
    nextParams.set("view", value);
    navigate(nextParams);
  }

  return (
    <div {...stylex.props(styles.content)}>
      <BottleCatalogList
        activeFilterCount={query ? 1 : 0}
        emptyAction={searchedQuery ? undefined : emptyAction}
        filters={
          displayedView ? (
            <FacetGroup
              label="Show"
              required
              onChange={updateView}
              options={[
                { label: "Distillery releases", value: "releases" },
                { label: "Other bottlings", value: "other" },
              ]}
              selected={displayedView}
            />
          ) : undefined
        }
        emptyDescription={
          searchedQuery
            ? `No ${entityName} bottles match "${searchedQuery}".`
            : distilleryView === "releases"
              ? `No distillery releases have been added for ${entityName} yet.`
              : distilleryView === "other"
                ? `No other bottlings have been added for ${entityName} yet.`
                : `No bottles have been added for ${entityName} yet.`
        }
        emptyHeading={
          searchedQuery
            ? "No matching bottles"
            : distilleryView === "releases"
              ? "No distillery releases yet"
              : distilleryView === "other"
                ? "No other bottlings yet"
                : "No bottles yet"
        }
        items={bottleList.results.map((bottle) =>
          toBottleListItem(bottle, {
            includeBottler: distilleryView === "other",
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        )}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.nextCursor,
        )}
        onClear={query ? () => updateQuery("") : undefined}
        onSortChange={updateSort}
        page={page}
        pending={isNavigating || isFetching}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          bottleList.rel.prevCursor,
        )}
        query={{
          label: "Find a bottle",
          onSubmit: (value) => updateQuery(value.trim()),
          placeholder: "Name or release",
          query,
        }}
        sort={sort}
        sortOptions={sortOptions}
        total={bottleList.total}
      />
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
});
