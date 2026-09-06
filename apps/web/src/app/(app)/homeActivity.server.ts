"server only";

import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";
import {
  homeActivityCriteria,
  publicHomeQueries,
} from "@peated/web/lib/orpc/homeQueries";
import type { QueryClient } from "@tanstack/react-query";
import { unstable_cache } from "next/cache";

const FIVE_MINUTES_IN_SECONDS = 5 * 60;

// Web caching rule: shared homepage activity always uses an anonymous client.
const loadPublicHomeCommunityActivity = unstable_cache(
  async () => {
    const { client } = await createAnonymousServerClient();
    return client.activity.list(homeActivityCriteria.community);
  },
  ["public-home-community-activity"],
  { revalidate: FIVE_MINUTES_IN_SECONDS },
);

const loadPublicHomeCriticReviews = unstable_cache(
  async () => {
    const { client } = await createAnonymousServerClient();
    return client.externalReviews.list(homeActivityCriteria.critics);
  },
  ["public-home-critic-reviews"],
  { revalidate: FIVE_MINUTES_IN_SECONDS },
);

export async function loadPublicHomeActivity(
  queryClient: QueryClient,
  orpc: ORPCQueryUtils,
) {
  await Promise.all([
    queryClient.prefetchQuery({
      ...publicHomeQueries.communityActivity(orpc),
      queryFn: loadPublicHomeCommunityActivity,
    }),
    queryClient.prefetchQuery({
      ...publicHomeQueries.criticReviews(orpc),
      queryFn: loadPublicHomeCriticReviews,
    }),
  ]);
}
