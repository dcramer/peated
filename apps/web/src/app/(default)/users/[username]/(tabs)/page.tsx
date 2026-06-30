"use client";
import { use } from "react";

import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function UserProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;

  const orpc = useORPC();
  const { data: tastings } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: { user: username, limit: 10 },
    }),
  );

  if (!tastings.results.length) {
    return <EmptyActivity />;
  }

  return <TastingList values={tastings.results} />;
}
