import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const trpcClient = await getTrpcClient();
  const user = await trpcClient.userById.ensureData(username);

  return {
    title: `@${user.username}`,
    openGraph: {
      type: "profile",
      profile: {
        username: user.username,
      },
    },
  };
}

export default async function UserTastings({
  params: { username },
}: {
  params: { username: string };
}) {
  const trpcClient = await getTrpcClient();
  const user = await trpcClient.userById.ensureData(username);
  const tastingList = await trpcClient.tastingList.ensureData({
    user: user.id,
  });

  return tastingList.results.length ? (
    <TastingList values={tastingList.results} />
  ) : (
    <EmptyActivity>Looks like this ones a bit short on tastings.</EmptyActivity>
  );
}
