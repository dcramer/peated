import type { Outputs } from "@peated/server/orpc/router";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getProfilePage } from "@peated/web/lib/profilePage.server";

import { ProfileOverviewPageClient } from "./profileOverviewPageClient.stylex";

export const fetchCache = "default-no-store";

export default async function ProfileOverviewPage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const [activityList, badgePage, tastingStats] = await Promise.all([
    client.users.activity.list({ limit: 3, user: user.id }),
    client.users.badgeList({ cursor: 1, limit: 100, user: user.id }),
    client.users.tastingStats({ user: user.id }),
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
    <ProfileOverviewPageClient
      initialActivityList={activityList}
      initialBadgeAwards={badgeAwards}
      initialTastingStats={tastingStats}
    />
  );
}
