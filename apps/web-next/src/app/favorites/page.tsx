"use client";

import Layout from "@peated/web-next/components/layout";
import SimpleHeader from "@peated/web-next/components/simpleHeader";
import useAuth from "@peated/web-next/hooks/useAuth";
import { redirectToAuth } from "@peated/web-next/lib/auth";
import { trpcClient } from "@peated/web-next/lib/trpc";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { Suspense } from "react";

export default function Favorites() {
  return (
    <Layout>
      <SimpleHeader>Favorites</SimpleHeader>
      <Suspense>
        <Content />
      </Suspense>
    </Layout>
  );
}

async function Content() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    redirectToAuth({ pathname: "/favorites" });
  }

  const { data: favoriteList } = trpcClient.collectionBottleList.useQuery({
    user: "me",
    collection: "default",
  });

  return favoriteList && favoriteList.results.length ? (
    <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
