"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { trpc } from "@peated/web/lib/trpc";

export const fetchCache = "default-no-store";

export default function Page() {
  const [favoriteList] = trpc.collectionBottleList.useSuspenseQuery({
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
