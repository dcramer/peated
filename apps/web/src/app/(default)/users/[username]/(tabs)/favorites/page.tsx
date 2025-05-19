import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { client } from "@peated/web/lib/orpc/client";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const user = await client.users.details({
    user: username,
  });

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
  const favoriteList = await client.collections.bottles.list({
    user: username,
    collection: "default",
  });

  return favoriteList.results.length ? (
    <BottleTable bottleList={favoriteList.results} rel={favoriteList.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
