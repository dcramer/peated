import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";

import { BottleOverviewClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  return getBottleSeoMetadata(bottle, { canonical: true });
}

export default async function BottlePage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const { client } = await getAnonymousServerClient();
  const seriesBottleList = bottle.series
    ? await client.bottles
        .list({
          limit: 4,
          series: bottle.series.id,
          sort: "-release",
        })
        .catch(() => undefined)
    : undefined;

  return <BottleOverviewClient initialSeriesBottles={seriesBottleList} />;
}
