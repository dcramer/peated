"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function Page() {
  const orpc = useORPC();
  const { data: favoriteList } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: "me",
        collection: "default",
      },
    })
  );

  return (
    <>
      {favoriteList.results.length ? (
        <BottleTable bottleList={favoriteList.results} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
      <PaginationButtons rel={favoriteList.rel} />
    </>
  );
}
