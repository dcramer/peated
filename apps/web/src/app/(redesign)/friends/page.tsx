import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

import { FriendsPageClient } from "./friendsPageClient.stylex";

export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/friends" });
  }

  const searchParams = await props.searchParams;
  const queryParams = getApiQueryParams(searchParams, {
    numericFields: ["cursor", "limit"],
    overrides: { limit: 50 },
  });
  const { client } = await getServerClient();
  const friendList = await client.friends.list(queryParams);

  return <FriendsPageClient initialFriendList={friendList} />;
}
