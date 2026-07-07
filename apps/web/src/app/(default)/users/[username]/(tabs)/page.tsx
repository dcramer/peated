"use client";
import { use } from "react";

import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
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
  const { data: tastings } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: { user: username, limit: 10 },
    }),
  );

  return (
    <div>
      {tastings.results.length ? (
        <TastingList values={tastings.results} />
      ) : (
        <EmptyActivity />
      )}

      <div className="mt-8 space-y-6 px-3 lg:px-0">
        <UserBadgeList userId={userId} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UserLocationChart userId={userId} />
          <UserFlavorDistributionChart userId={userId} />
        </div>
      </div>
    </div>
  );
}
