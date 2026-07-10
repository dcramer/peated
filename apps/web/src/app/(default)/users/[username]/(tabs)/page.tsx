"use client";
import { use } from "react";

import ActivityList, {
  filterFavoriteActivity,
} from "@peated/web/components/activityList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import UserFlavorDistributionChart from "@peated/web/components/userFlavorDistributionChart";
import UserLocationChart from "@peated/web/components/userLocationChart";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useProfileUserId } from "../profileContext";
import { UserBadgeList } from "../userBadgeList";

export const fetchCache = "default-no-store";

export default function UserProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;
  const userId = useProfileUserId();

  const orpc = useORPC();
  const { data: activity } = useSuspenseQuery({
    queryKey: ["profile-activity", username, "favorites-hidden"],
    queryFn: async () => {
      const results = [];
      let cursor: number | undefined;

      do {
        const page = await orpc.users.activity.list.call({
          user: username,
          limit: 10,
          cursor,
        });
        results.push(...filterFavoriteActivity(page.results));
        cursor = page.rel?.nextCursor ?? undefined;
      } while (results.length < 10 && cursor);

      return results.slice(0, 10);
    },
  });

  return (
    <div>
      <div className="mt-1 space-y-6 px-3 lg:px-0">
        <UserBadgeList userId={userId} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UserLocationChart userId={userId} />
          <UserFlavorDistributionChart userId={userId} />
        </div>
      </div>

      <div className="mt-8">
        {activity.length ? (
          <ActivityList values={activity} />
        ) : (
          <EmptyActivity />
        )}
      </div>
    </div>
  );
}
