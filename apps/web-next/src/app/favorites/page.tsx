"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpcClient } from "@peated/web/lib/trpc";

export default function Page() {
  useAuthRequired();

  const [favoriteList] = trpcClient.collectionBottleList.useSuspenseQuery({
    user: "me",
    collection: "default",
  });

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
