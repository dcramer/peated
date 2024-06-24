import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const trpcClient = await getTrpcClient();
  const user = await trpcClient.userById.ensureData(username);

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

export default async function UserFavorites({
  params: { username },
}: {
  params: { username: string };
}) {
  const trpcClient = await getTrpcClient();
  const favoriteList = await trpcClient.collectionBottleList.ensureData({
    user: username,
    collection: "default",
  });

  return favoriteList.results.length ? (
    <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
