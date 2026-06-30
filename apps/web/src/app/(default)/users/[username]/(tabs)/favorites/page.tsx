"use client";
import { use } from "react";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function UserFavorites(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;

  return <UserFavoritesTable username={username} />;
}

function UserFavoritesTable({ username }: { username: string }) {
  const orpc = useORPC();
  const { data: bottles } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: username,
        collection: "default",
      },
    }),
  );

  return bottles.results.length ? (
    <BottleTable bottleList={bottles.results} rel={bottles.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
