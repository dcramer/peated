"use client";

import ActivityFeed from "@peated/web/components/activityFeed";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function Page() {
  return (
    <AuthRequired>
      <FriendsActivityPage />
    </AuthRequired>
  );
}

function FriendsActivityPage() {
  const filter = "friends";
  const orpc = useORPC();
  const { data: activityList } = useSuspenseQuery(
    orpc.activity.list.queryOptions({
      input: {
        filter,
        limit: 10,
      },
    }),
  );

  return <ActivityFeed activityList={activityList} filter={filter} />;
}
