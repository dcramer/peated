import { json, type LoaderArgs, type V2_MetaFunction } from "@remix-run/node";
import { dehydrate, QueryClient, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import BottleTable from "~/components/bottleTable";
import EmptyActivity from "~/components/emptyActivity";

import Layout from "~/components/layout";
import SimpleHeader from "~/components/simpleHeader";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { redirectToAuth } from "~/lib/auth.server";
import { fetchBottlesInCollection } from "~/queries/collections";

export async function loader({ context, request }: LoaderArgs) {
  if (!context.user) return redirectToAuth({ request });

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["collections", "user", context.user.id, "default"],
    () => fetchBottlesInCollection(context.api, "me", "default"),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Favorites",
    },
  ];
};

export default function Favorites() {
  const api = useApi();
  const { user } = useAuth();

  invariant(user);

  const { data } = useQuery(["collections", "user", user.id, "default"], () =>
    fetchBottlesInCollection(api, "me", "default"),
  );

  return (
    <Layout>
      <SimpleHeader>Favorites</SimpleHeader>
      {data && data.results.length ? (
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
    </Layout>
  );
}
