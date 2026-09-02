"use client";

import type { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FactList, SectionError, TextLink } from "@peated/web/components";
import { BottleRowActions } from "@peated/web/components/bottleRowActions.stylex";
import Markdown from "@peated/web/components/markdown";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import {
  PageColumns,
  PageHeader,
} from "@peated/web/components/pages/pageLayout.stylex";
import useBottleRowActions from "@peated/web/hooks/useBottleRowActions";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

type BottleList = Outputs["bottles"]["list"];
type Series = Outputs["bottleSeries"]["details"];
type BottleSort = (typeof BOTTLE_LIST_SORT_OPTIONS)[number];

const sortOptions = [
  { label: "Latest release", value: "-release" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
  { label: "Recently added", value: "-created" },
] as const;

export function SeriesPageClient({
  initialBottleList,
  initialCursor,
  initialSeries,
  initialSort,
}: {
  initialBottleList: BottleList;
  initialCursor: number;
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
        limit: 25,
        series: initialSeries.id,
        sort: initialSort,
      },
    }),
    initialData: initialBottleList,
  });

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  const facts = [
    { label: "Series ID", value: initialSeries.peatedId },
    {
      label: "Bottles",
      value: initialBottleList.total.toLocaleString("en-US"),
    },
  ] as const;
  const bottleList = bottleListQuery.data;

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description={
          initialSeries.description ? (
            <Markdown content={initialSeries.description} />
          ) : undefined
        }
        eyebrow="Whisky series"
        parent={
          <TextLink href={getEntityUrl(initialSeries.brand)}>
            {initialSeries.brand.name}
          </TextLink>
        }
        title={initialSeries.name}
      />
      <PageColumns rail={<FactList facts={facts} />} railBehavior="stack">
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
              emptyDescription={`No bottles have been added to ${initialSeries.fullName} yet.`}
              emptyHeading="No bottles in this series yet"
              items={bottleList.results.map((bottle) => {
                const item = toBottleListItem(bottle, {
                  includeBrandInName: false,
                  includeBrandRow: false,
                  includeRatings: true,
                  includeRelatedReleases: true,
                  includeSeriesInName: false,
                });
                const isLibrary = bottleActions.isLibrary(bottle);

                return {
                  ...item,
                  end: (
                    <BottleRowActions
                      bottle={bottle}
                      controls={bottleActions}
                      label={item.name}
                      ratings={item.ratings}
                    />
                  ),
                  isLibrary,
                  ratings: undefined,
                };
              })}
              nextHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.nextCursor,
              )}
              onSortChange={updateSort}
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

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  bottles: {
    minWidth: 0,
    paddingTop: space.x4,
  },
});
