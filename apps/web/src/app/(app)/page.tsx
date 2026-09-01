import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getHomeSearchPlaceholder } from "@peated/web/app/(app)/_components/home/homeSearchPlaceholder";
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
import { homeMetadata } from "@peated/web/lib/seoMetadata";
import { getSession } from "@peated/web/lib/session.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { HomePageClient } from "./homePageClient";

export const metadata = homeMetadata;

export default async function Page() {
  const session = await getSession();
  const searchPlaceholder = getHomeSearchPlaceholder();
  const queryClient = getQueryClient();
  const { client } = session.user
    ? await getServerClient()
    : await getAnonymousServerClient();
  const orpc = createTanstackQueryUtils(client);

  await Promise.all([
    queryClient.prefetchQuery({
      ...publicHomeQueries.stats(orpc),
      queryFn: getPublicStats,
    }),
    queryClient.prefetchQuery(publicHomeQueries.recentReviews(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.releases(orpc)),
    ...(session.user
      ? [queryClient.prefetchQuery(memberHomeQueries.followedReleases(orpc))]
      : []),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient searchPlaceholder={searchPlaceholder} />
    </HydrationBoundary>
  );
}
