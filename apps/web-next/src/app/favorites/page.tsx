"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import SimpleHeader from "@peated/web/components/simpleHeader";
import Spinner from "@peated/web/components/spinner";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpcClient } from "@peated/web/lib/trpc";
import { Suspense } from "react";

export default function Page() {
  useAuthRequired();

  const [favoriteList] = trpcClient.collectionBottleList.useSuspenseQuery({
    user: "me",
    collection: "default",
  });

  return (
    <Layout>
      <SimpleHeader>Favorites</SimpleHeader>
      <Suspense fallback={<Spinner />}>
        <Content favoriteList={favoriteList} />
      </Suspense>
    </Layout>
  );
}

function Content({
  favoriteList,
}: {
  favoriteList: ReturnType<
    typeof trpcClient.collectionBottleList.useSuspenseQuery
  >;
}) {
  return favoriteList.results.length ? (
    <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
