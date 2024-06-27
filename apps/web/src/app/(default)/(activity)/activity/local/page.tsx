"use client";

import ActivityFeed from "@peated/web/components/activityFeed";

export default function Page() {
  const filter = "local";
  const filter = "friends";
  const [tastingList] = trpc.tastingList.useSuspenseQuery({
    filter,
    limit: 10,
  });

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
