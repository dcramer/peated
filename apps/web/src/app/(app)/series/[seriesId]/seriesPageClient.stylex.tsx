"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { Button, Chip, FactList, SectionError } from "@peated/web/components";
import { addBottleRowActions } from "@peated/web/components/bottleRowActions.stylex";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import useBottleRowActions from "@peated/web/hooks/useBottleRowActions";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";

import {
  SeriesPageContent,
  useSeriesPageFrame,
} from "./seriesPageFrame.stylex";
import {
  seriesPageQueries,
  type SeriesBottleSort,
  type SeriesLibraryFilter,
} from "./seriesPageQueries";

const sortOptions = [
  { label: "Latest release", value: "-release" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
  { label: "Recently added", value: "-created" },
] as const;

const libraryOptions = [
  { label: "All", value: "all" },
  { label: "Not in your Library", value: "out" },
  { label: "In your Library", value: "in" },
] as const;

export function SeriesPageClient({
  initialCursor,
  initialLibrary,
  initialLibraryCount,
  initialSort,
}: {
  initialCursor: number;
  initialLibrary: SeriesLibraryFilter;
  initialLibraryCount: number | null;
  initialSort: SeriesBottleSort;
}) {
  const orpc = useORPC();
  const { series } = useSeriesPageFrame();
  const bottleActions = useBottleRowActions();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayedSearchParams = new URLSearchParams(displayedParams);
  const bottleListQuery = useQuery(
    seriesPageQueries.bottles(orpc, {
      cursor: initialCursor,
      library: initialLibrary,
      seriesId: series.id,
      sort: initialSort,
    }),
  );

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(displayedParams);
    for (const [name, value] of Object.entries(updates)) {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    }
    nextParams.delete("cursor");
    startTransition(() => {
      setDisplayedParams(nextParams.toString());
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  const facts =
    initialLibraryCount === null
      ? ([{ label: "Bottles", value: series.numReleases }] as const)
      : ([
          { label: "Bottles", value: series.numReleases },
          {
            label: "In your Library",
            value: `${initialLibraryCount.toLocaleString("en-US")} of ${series.numReleases.toLocaleString("en-US")}`,
          },
        ] as const);
  const bottleList = bottleListQuery.data;
  const filtered = initialLibrary !== "all";
  const emptyState =
    initialLibrary === "in"
      ? {
          description: `None of the bottles from ${series.fullName} are in your Library.`,
          heading: "No bottles in your Library",
        }
      : initialLibrary === "out"
        ? {
            description: `Every bottle from ${series.fullName} on Peated is in your Library.`,
            heading: "Nothing missing",
          }
        : {
            description: `No bottles have been added to ${series.fullName} yet.`,
            heading: "No bottles in this series yet",
          };

  return (
    <SeriesPageContent
      facts={<FactList facts={facts} layout="grid" />}
      filters={
        initialLibraryCount !== null && series.numReleases > 0 ? (
          <>
            {libraryOptions.map((option) => {
              const selected =
                option.value ===
                (displayedSearchParams.get("library") ?? "all");
              return (
                <Chip
                  aria-pressed={selected}
                  key={option.value}
                  onClick={() =>
                    updateParams({
                      library: option.value === "all" ? "" : option.value,
                    })
                  }
                  variant={selected ? "solid" : "neutral"}
                >
                  {option.label}
                </Chip>
              );
            })}
          </>
        ) : undefined
      }
      bottles={
        <>
          {bottleListQuery.error ? (
            <SectionError
              heading="Bottles in this series are unavailable"
              onRetry={() => void bottleListQuery.refetch()}
            >
              The series page still works. Try loading the bottles again.
            </SectionError>
          ) : bottleList ? (
            <BottleCatalogList
              key={`${initialCursor}:${initialLibrary}:${initialSort}`}
              emptyAction={
                filtered ? (
                  <Button
                    onClick={() => updateParams({ library: "" })}
                    size="sm"
                    variant="tonal"
                  >
                    Show all bottles
                  </Button>
                ) : undefined
              }
              emptyDescription={emptyState.description}
              emptyHeading={emptyState.heading}
              items={bottleList.results.map((bottle) =>
                addBottleRowActions({
                  bottle,
                  controls: bottleActions,
                  item: toBottleListItem(bottle, {
                    includeBrandInName: false,
                    includeRatings: true,
                    includeRelatedReleases: true,
                    includeSeriesInName: false,
                  }),
                }),
              )}
              nextHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.nextCursor,
              )}
              onSortChange={(value) => updateParams({ sort: value })}
              page={initialCursor}
              pending={isNavigating || bottleListQuery.isFetching}
              previousHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.prevCursor,
              )}
              sort={displayedSearchParams.get("sort") ?? initialSort}
              sortOptions={sortOptions}
              total={bottleList.total}
            />
          ) : null}
        </>
      }
    />
  );
}
