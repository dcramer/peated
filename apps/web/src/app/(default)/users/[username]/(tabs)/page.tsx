import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const client = await getServerClient();
  const user = await client.users.details({ user: username });

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

export default async function UserProfilePage({
  params: { username },
}: {
  params: { username: string };
}) {
  const client = await getServerClient();
  const tastings = await client.tastings.list({ user: username, limit: 10 });

  if (!tastings.results.length) {
    return <EmptyActivity />;
  }

  return <TastingList values={tastings.results} />;
}
