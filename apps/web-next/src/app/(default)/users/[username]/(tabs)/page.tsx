import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { getUser } from "../../utils.server";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const user = await getUser(username);

  return {
    title: `@{$user.username}`,
    openGraph: {
      type: "profile",
      profile: {
        username: user.username,
      },
    },
  };
}

export default async function UserDetails({
  params: { username },
}: {
  params: { username: string };
}) {
  const user = await getUser(username);
  const trpcClient = await getTrpcClient();
  const tastingList = await trpcClient.tastingList.query({
    user: user.id,
  });

  return tastingList.results.length ? (
    <TastingList values={tastingList.results} />
  ) : (
    <EmptyActivity>Looks like this ones a bit short on tastings.</EmptyActivity>
  );
}
