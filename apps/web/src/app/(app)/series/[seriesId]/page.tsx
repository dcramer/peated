import { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getSeriesSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getSeriesPage } from "@peated/web/lib/seriesPage.server";
import type { Metadata } from "next";

import { SeriesPageClient } from "./seriesPageClient.stylex";

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

export async function generateMetadata(props: {
  params: Promise<{ seriesId: string }>;
}): Promise<Metadata> {
  const { seriesId } = await props.params;
  const series = await getSeriesPage(parseCatalogRouteId(seriesId));
  return getSeriesSeoMetadata(series, { canonical: true });
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
  const { client } = await getPublicPageServerClient();
  const bottleList = await client.bottles.list({
    cursor,
    limit: 25,
    series: series.id,
    sort,
  });

  return (
    <SeriesPageClient
      initialBottleList={bottleList}
      initialCursor={cursor}
      initialSeries={series}
      initialSort={sort}
    />
  );
}
