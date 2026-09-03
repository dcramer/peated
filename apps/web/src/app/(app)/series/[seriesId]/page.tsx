import { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { serializeSeriesStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getSeriesSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getSeriesPage } from "@peated/web/lib/seriesPage.server";
import type { Metadata } from "next";

import {
  SeriesPageClient,
  type SeriesLibraryFilter,
} from "./seriesPageClient.stylex";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCursor(value: string | undefined) {
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor > 0 ? cursor : 1;
}

function getSort(value: string | undefined) {
  return BOTTLE_LIST_SORT_OPTIONS.find((sort) => sort === value) ?? "-release";
}

function getLibraryFilter(value: string | undefined): SeriesLibraryFilter {
  return value === "in" || value === "out" ? value : "all";
}

export async function generateMetadata(props: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { seriesId } = await props.params;
  const series = await getSeriesPage(parseCatalogRouteId(seriesId));
  return getSeriesSeoMetadata(series, {
    canonical: true,
    searchParams: await props.searchParams,
  });
}

export default async function SeriesPage(props: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ seriesId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const series = await getSeriesPage(parseCatalogRouteId(seriesId));
  const cursor = getCursor(firstValue(searchParams.cursor));
  const sort = getSort(firstValue(searchParams.sort));
  const [currentUser, { client }] = await Promise.all([
    getCurrentUser(),
    getPublicPageServerClient(),
  ]);
  const library = currentUser
    ? getLibraryFilter(firstValue(searchParams.library))
    : "all";
  const [bottleList, libraryBottleList] = await Promise.all([
    client.bottles.list({
      cursor,
      library: library === "all" ? undefined : library,
      limit: 25,
      series: series.id,
      sort,
    }),
    currentUser
      ? client.bottles.list({
          library: "in",
          limit: 1,
          series: series.id,
        })
      : null,
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSeriesStructuredData(series),
        }}
      />
      <SeriesPageClient
        initialBottleList={bottleList}
        initialCursor={cursor}
        initialLibrary={library}
        initialLibraryCount={libraryBottleList?.total ?? null}
        initialSeries={series}
        initialSort={sort}
      />
    </>
  );
}
