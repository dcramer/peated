"use client";

import Layout from "@peated/web-next/components/layout";
import SimpleHeader from "@peated/web-next/components/simpleHeader";
import Spinner from "@peated/web-next/components/spinner";
import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import { trpcClient } from "@peated/web-next/lib/trpc";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
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
