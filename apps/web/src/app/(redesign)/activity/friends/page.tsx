import { HomeActivity } from "@peated/web/components/designSystem/product/homeActivity.stylex";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Friends' activity" };

export default async function FriendsActivityPage() {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/activity/friends" });
  }

  const { client } = await getServerClient();
  const activityList = await client.activity.list({
    filter: "friends",
    limit: 10,
  });

  return <HomeActivity filter="friends" initialData={activityList} />;
}
