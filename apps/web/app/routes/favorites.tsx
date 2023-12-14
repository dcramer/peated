import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useAuth from "@peated/web/hooks/useAuth";
import { redirectToAuth } from "@peated/web/lib/auth.server";
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { type SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  context: { trpc, user },
  request,
}: LoaderFunctionArgs) {
  if (!user) return redirectToAuth({ request });

  return json({
    favoriteList: await trpc.collectionBottleList.query({
      user: "me",
      collection: "default",
    }),
  });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Favorites",
    },
  ];
};

export default function Favorites() {
  const { user } = useAuth();
  const { favoriteList } = useLoaderData<typeof loader>();

  invariant(user);

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
