"use client";

import Layout from "@peated/web-next/components/layout";
import SimpleHeader from "@peated/web-next/components/simpleHeader";
import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import { trpcClient } from "@peated/web-next/lib/trpc";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";

export default function Page() {
  useAuthRequired();

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
