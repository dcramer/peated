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
import { Suspense } from "react";

import {
  PublicHomeContent,
  PublicHomeContentLoading,
} from "./_components/home/publicHome.stylex";
import { loadPublicHomeLocations } from "./homeLocations.server";
import { HomePageClient } from "./homePageClient";

export const metadata = homeMetadata;

export default function Page() {
  // Playwright screenshots require stable copy. Production keeps rotating hints.
  const searchPlaceholder = getHomeSearchPlaceholder(
    process.env.PLAYWRIGHT_TEST ? () => 0 : undefined,
  );

  return (
    <HomePageClient searchPlaceholder={searchPlaceholder}>
      <Suspense fallback={<PublicHomeContentLoading />}>
        <HomeContent />
      </Suspense>
    </HomePageClient>
  );
}

async function HomeContent() {
  const session = await getSession();
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
    queryClient.prefetchQuery(publicHomeQueries.events(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.memberActivity(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.recentReviews(orpc)),
    queryClient.prefetchQuery(publicHomeQueries.releases(orpc)),
    loadPublicHomeLocations(queryClient, orpc),
    ...(session.user
      ? [queryClient.prefetchQuery(memberHomeQueries.followedReleases(orpc))]
      : []),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PublicHomeContent />
    </HydrationBoundary>
  );
}
