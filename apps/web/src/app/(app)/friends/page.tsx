import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  FriendsListClient,
  FriendsListLoading,
  FriendsPageFrame,
} from "./friendsPageClient.stylex";

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

  return (
    <FriendsPageFrame>
      <Suspense
        key={String(queryParams.cursor ?? 1)}
        fallback={<FriendsListLoading />}
      >
        <FriendsResults queryParams={queryParams} />
      </Suspense>
    </FriendsPageFrame>
  );
}

async function FriendsResults({
  queryParams,
}: {
  queryParams: ReturnType<typeof getApiQueryParams>;
}) {
  const { client } = await getServerClient();
  const friendList = await client.friends.list(queryParams);
  return <FriendsListClient initialFriendList={friendList} />;
}
