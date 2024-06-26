"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import { trpc } from "@peated/web/lib/trpc";

export default function Page() {
  const filter = "global";
  const [tastingList] = trpc.tastingList.useSuspenseQuery({
    filter,
    limit: 10,
  });

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
