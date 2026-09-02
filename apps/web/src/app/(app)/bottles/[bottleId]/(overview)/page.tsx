import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { bottleOverviewQueries } from "../bottleOverviewQueries";
import { BottleOverviewClient } from "../bottlePageClient.stylex";

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
  const queryClient = getQueryClient();
  const { client } = await getPublicPageServerClient();
  const orpc = createTanstackQueryUtils(client);

  await Promise.all([
    queryClient.prefetchQuery(
      orpc.bottles.flavorProfile.queryOptions({ input: { bottle: bottle.id } }),
    ),
    queryClient.prefetchQuery(bottleOverviewQueries.reviews(orpc, bottle.id)),
    queryClient.prefetchQuery(bottleOverviewQueries.tastings(orpc, bottle.id)),
    ...(bottle.series
      ? [
          queryClient.prefetchQuery(
            bottleOverviewQueries.series(orpc, bottle.series.id),
          ),
        ]
      : []),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BottleOverviewClient />
    </HydrationBoundary>
  );
}
