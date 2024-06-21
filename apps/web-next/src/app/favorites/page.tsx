"use client";

import Layout from "@peated/web-next/components/layout";
import SimpleHeader from "@peated/web-next/components/simpleHeader";
import { trpcClient } from "@peated/web-next/lib/trpc";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";

export default function Page() {
  // const { isLoggedIn } = useAuth();

  // if (!isLoggedIn) {
  //   redirectToAuth({ pathname: "/favorites" });
  // }

  const { data: favoriteList } = trpcClient.collectionBottleList.useQuery({
    user: "me",
    collection: "default",
  });

  return (
    <Layout>
      <SimpleHeader>Favorites</SimpleHeader>
      {favoriteList && favoriteList.results.length ? (
        <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
    </Layout>
  );
}
