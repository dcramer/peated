"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function UserProfilePage({
  params: { username },
}: {
  params: { username: string };
}) {
  const orpc = useORPC();
  const { data: tastings } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: { user: username, limit: 10 },
    })
  );

  if (!tastings.results.length) {
    return <EmptyActivity />;
  }

  return <TastingList values={tastings.results} />;
}
