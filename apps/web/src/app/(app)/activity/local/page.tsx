import { HomeActivity } from "@peated/web/app/(app)/_components/home/homeActivity.stylex";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Local activity" };

export default async function LocalActivityPage() {
  const { client } = await getAnonymousServerClient();
  const activityList = await client.activity.list({
    filter: "local",
    limit: 10,
  });

  return <HomeActivity filter="local" initialData={activityList} />;
}
