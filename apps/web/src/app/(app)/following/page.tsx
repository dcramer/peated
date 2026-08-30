import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

import { FollowingPageClient } from "./followingPageClient.stylex";
import {
  getFollowingPageState,
  type FollowingPageSearchParams,
} from "./followingPageData";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage(props: {
  searchParams: Promise<FollowingPageSearchParams>;
}) {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/following" });
  }

  const state = getFollowingPageState(await props.searchParams);
  const { client } = await getServerClient();
  const entityList = await client.entities.list(state.input);

  return <FollowingPageClient initialEntityList={entityList} />;
}
