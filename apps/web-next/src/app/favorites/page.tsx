import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favorites",
};

export default async function Page() {
  if (!(await isLoggedIn())) {
    return redirectToAuth({ pathname: "/favorites" });
  }
  const trpcClient = await getTrpcClient();
  const favoriteList = await trpcClient.collectionBottleList.query({
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
