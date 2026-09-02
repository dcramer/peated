"use client";

import type { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Chip,
  FactList,
  PeatedId,
  RailList,
  RailListItem,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { addBottleRowActions } from "@peated/web/components/bottleRowActions.stylex";
import Markdown from "@peated/web/components/markdown";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import {
  PageColumns,
  PageHeader,
} from "@peated/web/components/pages/pageLayout.stylex";
import { RailListSection } from "@peated/web/components/pages/railListSection.stylex";
import useBottleRowActions from "@peated/web/hooks/useBottleRowActions";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

type BottleList = Outputs["bottles"]["list"];
type Series = Outputs["bottleSeries"]["details"];
type BottleSort = (typeof BOTTLE_LIST_SORT_OPTIONS)[number];
export type SeriesLibraryFilter = "all" | "in" | "out";

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

const DISTILLERY_PREVIEW_LIMIT = 5;

export function SeriesPageClient({
  initialBottleList,
  initialCursor,
  initialLibrary,
  initialLibraryCount,
  initialSeries,
  initialSort,
}: {
  initialBottleList: BottleList;
  initialCursor: number;
  initialLibrary: SeriesLibraryFilter;
  initialLibraryCount: number | null;
  initialSeries: Series;
  initialSort: BottleSort;
}) {
  const orpc = useORPC();
  const bottleActions = useBottleRowActions();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottleListQuery = useQuery({
    ...orpc.bottles.list.queryOptions({
      input: {
        cursor: initialCursor,
        library: initialLibrary === "all" ? undefined : initialLibrary,
        limit: 25,
        series: initialSeries.id,
        sort: initialSort,
      },
    }),
    initialData: initialBottleList,
  });

  function updateParams(updates: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(updates)) {
      if (value) nextParams.set(name, value);
      else nextParams.delete(name);
    }
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  const facts =
    initialLibraryCount === null
      ? ([{ label: "Bottles", value: initialSeries.numReleases }] as const)
      : ([
          { label: "Bottles", value: initialSeries.numReleases },
          {
            label: "In your Library",
            value: `${initialLibraryCount.toLocaleString("en-US")} of ${initialSeries.numReleases.toLocaleString("en-US")}`,
          },
        ] as const);
  const bottleList = bottleListQuery.data;
  const filtered = initialLibrary !== "all";
  const emptyState =
    initialLibrary === "in"
      ? {
          description: `None of the bottles from ${initialSeries.fullName} are in your Library.`,
          heading: "No bottles in your Library",
        }
      : initialLibrary === "out"
        ? {
            description: `Every bottle from ${initialSeries.fullName} on Peated is in your Library.`,
            heading: "Nothing missing",
          }
        : {
            description: `No bottles have been added to ${initialSeries.fullName} yet.`,
            heading: "No bottles in this series yet",
          };

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description={
          initialSeries.description ? (
            <Markdown content={initialSeries.description} />
          ) : undefined
        }
        identity={<PeatedId id={initialSeries.peatedId} />}
        parent={
          <TextLink href={getEntityUrl(initialSeries.brand)}>
            {initialSeries.brand.name}
          </TextLink>
        }
        title={
          <span {...stylex.props(styles.title)}>{initialSeries.name}</span>
        }
      />
      <PageColumns
        rail={
          initialSeries.distillers.length ? (
            <SeriesDistilleries distillers={initialSeries.distillers} />
          ) : undefined
        }
        railBehavior="stack"
      >
        <FactList facts={facts} layout="grid" />
        {initialLibraryCount !== null && initialSeries.numReleases > 0 ? (
          <div
            aria-label="Library filter"
            role="group"
            {...stylex.props(styles.filters)}
          >
            {libraryOptions.map((option) => {
              const selected = option.value === initialLibrary;
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
          </div>
        ) : null}
        <div {...stylex.props(styles.bottles)}>
          {bottleListQuery.error ? (
            <SectionError
              heading="Bottles in this series are unavailable"
              onRetry={() => void bottleListQuery.refetch()}
            >
              The series page still works. Try loading the bottles again.
            </SectionError>
          ) : bottleList ? (
            <BottleCatalogList
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
                    includeBrandRow: false,
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
              previousHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.prevCursor,
              )}
              sort={initialSort}
              sortOptions={sortOptions}
              total={bottleList.total}
            />
          ) : null}
        </div>
      </PageColumns>
    </div>
  );
}

function SeriesDistilleries({
  distillers,
}: {
  distillers: Series["distillers"];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = distillers.length > DISTILLERY_PREVIEW_LIMIT;
  const visibleDistillers = expanded
    ? distillers
    : distillers.slice(0, DISTILLERY_PREVIEW_LIMIT);

  return (
    <RailListSection
      action={
        hasMore
          ? {
              ariaControls: "series-distilleries",
              expanded,
              label: expanded
                ? "Show fewer distilleries"
                : `View all ${distillers.length.toLocaleString("en-US")} distilleries`,
              onClick: () => setExpanded((value) => !value),
            }
          : undefined
      }
      heading={distillers.length === 1 ? "Distillery" : "Distilleries"}
    >
      <div id="series-distilleries">
        <RailList ariaLabel="Series distilleries">
          {visibleDistillers.map((distiller) => (
            <RailListItem
              end={`${distiller.numBottles.toLocaleString("en-US")} ${
                distiller.numBottles === 1 ? "bottle" : "bottles"
              }`}
              href={getEntityUrl(distiller)}
              key={distiller.id}
              title={distiller.name}
            />
          ))}
        </RailList>
      </div>
    </RailListSection>
  );
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  title: {
    display: "block",
    fontSize: {
      default: null,
      "@media (max-width: 480px)": "36px",
    },
    overflowWrap: "anywhere",
  },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  bottles: {
    minWidth: 0,
    paddingTop: space.x4,
  },
});
