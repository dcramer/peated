import { PageTabs } from "@peated/web/components";
import { ActivityPage } from "@peated/web/components/pages/activityPage.stylex";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import {
  getAnonymousServerClient,
  getServerClient,
} from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";
import { loadActivityFeed } from "./loadActivityFeed";

export const metadata: Metadata = {
  title: "Activity",
  description: "Recent whisky tastings and reviews on Peated.",
};

export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const [{ feed }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const following = feed === "following" || (feed !== "everyone" && !!user);
  const { client: publicClient } = await getAnonymousServerClient();
  const memberClient =
    following && user ? (await getServerClient()).client : undefined;
  const { items, note } = await loadActivityFeed({
    following,
    memberClient,
    publicClient,
  });

  return (
    <ActivityPage
      items={items}
      note={note}
      selector={
        <PageTabs
          ariaLabel="Activity feeds"
          currentHref={`/activity?feed=${following ? "following" : "everyone"}`}
          items={[
            { href: "/activity?feed=following", label: "Following" },
            { href: "/activity?feed=everyone", label: "Everyone" },
          ]}
        />
      }
    />
  );
}
