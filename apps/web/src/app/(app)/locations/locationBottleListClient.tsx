"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";

import {
  LOCATION_BOTTLE_DEFAULT_SORT,
  LOCATION_BOTTLE_QUERY_FIELDS,
  LOCATION_BOTTLE_SORT_OPTIONS,
} from "./locationBottleList";

type BottleList = Outputs["bottles"]["list"];

export function LocationBottleListClient({
  country,
  initialBottleList,
  locationName,
  region,
}: {
  country: string;
  initialBottleList: BottleList;
  locationName: string;
  region?: string;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParams = normalizeBottleCatalogQueryParams(
    useApiQueryParams({
      defaults: { sort: LOCATION_BOTTLE_DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: LOCATION_BOTTLE_QUERY_FIELDS,
      numericFields: ["cursor"],
      overrides: { country, limit: 25, region },
    }),
  );
  const { data: bottleList, isFetching } = useSuspenseQuery({
    ...orpc.bottles.list.queryOptions({ input: queryParams }),
    initialData: initialBottleList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const [isNavigating, startTransition] = useTransition();
  const [sort, setSort] = useOptimistic(
    String(queryParams.sort ?? LOCATION_BOTTLE_DEFAULT_SORT),
  );

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    startTransition(() => {
      setSort(value);
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  return (
    <BottleCatalogList
      emptyDescription={`No bottles produced in ${locationName} have been added yet.`}
      emptyHeading="No bottles yet"
      items={bottleList.results.map((bottle) =>
        toBottleListItem(bottle, {
          includeRatings: true,
          includeRelatedReleases: true,
        }),
      )}
      nextHref={getCursorHref(
        pathname,
        searchParams,
        bottleList.rel.nextCursor,
      )}
      onSortChange={updateSort}
      page={page}
      pending={isNavigating || isFetching}
      previousHref={getCursorHref(
        pathname,
        searchParams,
        bottleList.rel.prevCursor,
      )}
      sort={sort}
      sortOptions={LOCATION_BOTTLE_SORT_OPTIONS}
      total={bottleList.total}
    />
  );
}
