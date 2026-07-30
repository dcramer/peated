"use client";

import { use } from "react";

import ActivityList, {
  filterFavoriteActivity,
} from "@peated/web/components/activityList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

const MAX_ACTIVITY_PAGES = 10;

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
      let fetchedPageCount = 0;

      do {
        const page = await orpc.users.activity.list.call({
          user: username,
          limit: 10,
          cursor,
        });
        fetchedPageCount += 1;
        results.push(...filterFavoriteActivity(page.results));
        cursor = page.rel?.nextCursor ?? undefined;
      } while (
        results.length < 10 &&
        cursor &&
        fetchedPageCount < MAX_ACTIVITY_PAGES
      );

      return results.slice(0, 10);
    },
  });

  return activity.length ? (
    <ActivityList values={activity} />
  ) : (
    <EmptyActivity />
  );
}
