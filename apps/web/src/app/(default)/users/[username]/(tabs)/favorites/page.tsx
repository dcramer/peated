"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Spinner from "@peated/web/components/spinner";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function UserFavorites({
  params: { username },
}: {
  params: { username: string };
}) {
  const { isLoading } = useAuth();

  if (isLoading) return <Spinner />;

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
