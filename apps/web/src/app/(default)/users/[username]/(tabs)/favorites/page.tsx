import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}) {
  const params = await props.params;

  const { username } = params;

  const trpcClient = await getTrpcClient();
  const user = await trpcClient.userById.fetch(username);

  return {
    title: `Favorites by @${user.username}`,
    openGraph: {
      type: "profile",
      profile: {
        username: user.username,
      },
    },
  };
}

export default async function UserFavorites(props: {
  params: Promise<{ username: string }>;
}) {
  const params = await props.params;

  const { username } = params;

  const trpcClient = await getTrpcClient();
  const favoriteList = await trpcClient.collectionBottleList.fetch({
    user: username,
    collection: "default",
  });

  return favoriteList.results.length ? (
    <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
