import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import {
  getAnonymousServerClient,
  getPublicPageServerClient,
} from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getPageBottleList } from "@peated/web/lib/publicCatalog.server";
import { serializeMemberReviewStructuredData } from "@peated/web/lib/reviewSeo";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from "@tanstack/react-query";
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
  const id = parseCatalogRouteId(bottleId);
  const queryClient = getQueryClient();
  // Web performance: read the page data alongside the Bottle, using the route
  // ID. A merged Bottle has another ID, and getBottlePage redirects before
  // these results are shown.
  const [bottle, publicMemberReviews] = await Promise.all([
    getBottlePage(id),
    prefetchBottleOverview(queryClient, id),
  ]);
  if (bottle.series) {
    const { client } = await getPublicPageServerClient();
    const seriesQuery = bottleOverviewQueries.series(
      createTanstackQueryUtils(client),
      bottle.series.id,
    );
    await queryClient.prefetchQuery({
      ...seriesQuery,
      queryFn: () => getPageBottleList(seriesQuery.input),
    });
  }
  const firstPublicReview = publicMemberReviews.results[0];
  const structuredData = firstPublicReview
    ? serializeMemberReviewStructuredData({ ...firstPublicReview, bottle })
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <BottleOverviewClient />
      </HydrationBoundary>
    </>
  );
}

/** Prefetches the overview's reads and returns the newest public review. */
async function prefetchBottleOverview(
  queryClient: QueryClient,
  bottleId: number,
) {
  const [{ client }, { client: anonymousClient }] = await Promise.all([
    getPublicPageServerClient(),
    getAnonymousServerClient(),
  ]);
  const orpc = createTanstackQueryUtils(client);
  const anonymousOrpc = createTanstackQueryUtils(anonymousClient);

  const [, publicMemberReviews] = await Promise.all([
    queryClient.prefetchQuery(
      orpc.bottles.flavorProfile.queryOptions({ input: { bottle: bottleId } }),
    ),
    queryClient.fetchQuery(
      anonymousOrpc.memberReviews.list.queryOptions({
        input: { bottle: bottleId, limit: 1 },
      }),
    ),
    queryClient.prefetchQuery(
      bottleOverviewQueries.reviewsAndTastings(orpc, bottleId),
    ),
  ]);
  return publicMemberReviews;
}
