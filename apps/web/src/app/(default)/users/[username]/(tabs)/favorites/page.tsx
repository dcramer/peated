"use client";
import { use } from "react";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import FavoriteEntryActions from "@peated/web/components/favoriteEntryActions";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useProfileUserId } from "../../profileContext";

export default function UserFavorites(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;

  return <UserFavoritesTable username={username} />;
}

function UserFavoritesTable({ username }: { username: string }) {
  const orpc = useORPC();
  const { user } = useAuth();
  const profileUserId = useProfileUserId();
  const queryParams = useApiQueryParams({
    overrides: {
      user: username,
      collection: "default",
    },
  });
  const { data: bottles } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: queryParams,
    }),
  );
  const canEditFavorites = user?.id === profileUserId;

  return bottles.results.length ? (
    <BottleTable
      bottleList={bottles.results}
      rel={bottles.rel}
      renderCollectionBottleActions={
        canEditFavorites
          ? (entry) => (
              <FavoriteEntryActions entry={entry} username={username} />
            )
          : undefined
      }
    />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
