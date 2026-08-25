"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import ActivityTabs from "../../activityTabs";

export const fetchCache = "default-no-store";

export default function Page() {
  const filter = "local";
  const orpc = useORPC();
  const { data: activityList } = useSuspenseQuery(
    orpc.activity.list.queryOptions({
      input: {
        filter,
        limit: 10,
      },
    }),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <ActivityTabs />
      <ActivityFeed activityList={activityList} filter={filter} />
    </div>
  );
}
