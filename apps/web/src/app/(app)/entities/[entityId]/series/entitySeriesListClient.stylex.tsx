"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import {
  CursorPager,
  EmptyState,
  ItemList,
  ItemListItem,
  ListToolbar,
  SeriesIdentityRow,
} from "@peated/web/components";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getBottleSeriesUrl } from "@peated/web/lib/urls";
import { space } from "../../../../../styles/tokens.stylex";

import { getEntitySeriesInput } from "./entitySeriesParams";

type BottleSeriesList = Outputs["bottleSeries"]["list"];

const sortOptions = [
  { label: "Most bottles", value: "-bottles" },
  { label: "Name", value: "name" },
] as const;

export function EntitySeriesListClient({
  distilleryId,
  distilleryName,
  initialSeriesList,
}: {
  distilleryId: number;
  distilleryName: string;
  initialSeriesList: BottleSeriesList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryInput = getEntitySeriesInput(distilleryId, searchParams);
  const { data: seriesList, isFetching } = useSuspenseQuery({
    ...orpc.bottleSeries.list.queryOptions({ input: queryInput }),
    initialData: initialSeriesList,
  });
  const [isNavigating, startTransition] = useTransition();
  const [sort, setSort] = useOptimistic(queryInput.sort ?? "-bottles");
  const page = Number(queryInput.cursor ?? 1);

  function updateSort(value: string) {
    const nextSort = value === "name" ? "name" : "-bottles";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", nextSort);
    nextParams.delete("cursor");
    startTransition(() => {
      setSort(nextSort);
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  return (
    <section
      aria-label={`Series featuring whisky from ${distilleryName}`}
      {...stylex.props(styles.content)}
    >
      <ListToolbar
        count={seriesList.results.length}
        noun="series"
        onSortChange={updateSort}
        pending={isNavigating || isFetching}
        pluralNoun="series"
        sort={sort}
        sortOptions={sortOptions}
        total={seriesList.total}
      />
      {seriesList.results.length ? (
        <ItemList ariaLabel={`${distilleryName} series`}>
          {seriesList.results.map((series) => (
            <ItemListItem key={series.id}>
              <SeriesIdentityRow
                brand={series.brand.name}
                end={formatBottleCount(series.numBottles)}
                href={getBottleSeriesUrl(series)}
                name={series.name}
              />
            </ItemListItem>
          ))}
        </ItemList>
      ) : (
        <EmptyState heading="No series yet">
          No series with bottles from {distilleryName} have been added yet.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel={`${distilleryName} series pages`}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          seriesList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          seriesList.rel.prevCursor,
        )}
      />
    </section>
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "bottle" : "bottles"}`;
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
});
