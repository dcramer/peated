"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function Page() {
  useAuthRequired();

  const filter = "friends";
  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: {
        filter,
        limit: 10,
      },
    })
  );

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
