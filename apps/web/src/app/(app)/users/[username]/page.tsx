import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Outputs } from "@peated/server/orpc/router";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ProfileOverviewPageClient } from "./profileOverviewPageClient.stylex";
import { profileQueries } from "./profileQueries";

export const fetchCache = "default-no-store";

export default async function ProfileOverviewPage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const queryClient = getQueryClient();
  const orpc = createTanstackQueryUtils(client);
  const [activityList, badgePage] = await Promise.all([
    client.users.activity.list({ limit: 3, user: user.id }),
    client.users.badgeList({ cursor: 1, limit: 100, user: user.id }),
    queryClient.prefetchQuery(profileQueries.tastingStats(orpc, user.id)),
  ]);
  const badgeAwards: Outputs["users"]["badgeList"]["results"] = [
    ...badgePage.results,
  ];
  let badgeCursor = badgePage.rel.nextCursor;

  while (badgeCursor) {
    const nextBadgePage = await client.users.badgeList({
      cursor: badgeCursor,
      limit: 100,
      user: user.id,
    });
    badgeAwards.push(...nextBadgePage.results);
    badgeCursor = nextBadgePage.rel.nextCursor;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileOverviewPageClient
        initialActivityList={activityList}
        initialBadgeAwards={badgeAwards}
      />
    </HydrationBoundary>
  );
}
