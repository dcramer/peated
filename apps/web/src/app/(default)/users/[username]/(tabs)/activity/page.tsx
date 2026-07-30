"use client";

import { use } from "react";

import ActivityList, {
  filterFavoriteActivity,
} from "@peated/web/components/activityList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function UserActivityPage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(props.params);
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

  return activity.length ? (
    <ActivityList values={activity} />
  ) : (
    <EmptyActivity />
  );
}
