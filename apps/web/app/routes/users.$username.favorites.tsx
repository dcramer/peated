import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { username }, context: { trpc } }) => {
    invariant(username);

    return {
      favoriteList: await trpc.collectionBottleList.query({
        user: username,
        collection: "default",
      }),
    };
  },
);

export default function ProfileCollections() {
  const { favoriteList } = useLoaderData<typeof loader>();

  return (
    <>
      {favoriteList && favoriteList.results.length ? (
        <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
    </>
  );
}
