"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import { trpc } from "@peated/web/lib/trpc/client";

export const fetchCache = "default-no-store";

export default function Page() {
  const filter = "friends";
  const [tastingList] = trpc.tastingList.useSuspenseQuery({
    filter,
    limit: 10,
  });

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
