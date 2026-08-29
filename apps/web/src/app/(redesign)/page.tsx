import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
  getAnonymousServerClient,
  getServerClient,
} from "@peated/web/lib/orpc/client.server";
import {
  memberHomeQueries,
  publicHomeQueries,
} from "@peated/web/lib/orpc/homeQueries";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import { getSession } from "@peated/web/lib/session.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { HomePageClient } from "./homePageClient";

export default async function Page() {
  const session = await getSession();
  const queryClient = getQueryClient();

  if (session.user) {
    const { client } = await getServerClient();
    const orpc = createTanstackQueryUtils(client);

    await Promise.all([
      queryClient.prefetchInfiniteQuery(
        memberHomeQueries.activity(orpc, "friends"),
      ),
      queryClient.prefetchQuery(memberHomeQueries.criticReviews(orpc)),
      queryClient.prefetchQuery(memberHomeQueries.releases(orpc)),
      queryClient.prefetchQuery(memberHomeQueries.member(orpc)),
      queryClient.prefetchQuery(memberHomeQueries.tastingStats(orpc)),
    ]);

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomePageClient />
      </HydrationBoundary>
    );
  }

  const { client } = await getAnonymousServerClient();
  const orpc = createTanstackQueryUtils(client);

  await Promise.all([
    queryClient.prefetchQuery({
      ...publicHomeQueries.stats(orpc),
      queryFn: getPublicStats,
    }),
    queryClient.prefetchQuery(publicHomeQueries.recentReviews(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.regions(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.countries(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.distilleries(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.recentBottles(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.highestRated(orpc)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient />
    </HydrationBoundary>
  );
}
