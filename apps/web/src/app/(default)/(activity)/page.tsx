"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function Page() {
  const filter = "global";
  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({ input: { limit: 10, filter } }),
  );

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
