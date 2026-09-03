import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { PageTabs } from "@peated/web/components";
import { ActivityPage } from "@peated/web/components/pages/activityPage.stylex";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import {
  getAnonymousServerClient,
  getServerClient,
} from "@peated/web/lib/orpc/client.server";
import { getBottleUrl } from "@peated/web/lib/urls";
import type { Metadata } from "next";
import { loadActivityFeed } from "./loadActivityFeed";

export const metadata: Metadata = {
  title: "Activity",
  description:
    "Recent whisky tastings, reviews, and library additions on Peated.",
};

export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const [{ feed }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const following = feed === "following" || (feed !== "everyone" && !!user);
  const { client: publicClient } = await getAnonymousServerClient();
  const memberClient = user ? (await getServerClient()).client : undefined;
  const [{ items, note }, library] = await Promise.all([
    loadActivityFeed({ following, memberClient, publicClient }),
    memberClient?.collections.bottles.list({
      user: "me",
      collection: "library",
      limit: 25,
    }),
  ]);
  const libraryBottles = (library?.results ?? [])
    .filter((item) => !item.hasTasted)
    .slice(0, 3)
    .map((item) => ({
      href: getBottleUrl(item.bottle),
      imageUrl: item.imageUrl ?? item.bottle.imageUrl,
      name: formatBottleDisplayName(item.bottle),
      metadata: getBottleMetadata(item.bottle),
    }));

  return (
    <ActivityPage
      items={items}
      libraryBottles={libraryBottles}
      libraryHref={user ? `/users/${user.username}/library` : undefined}
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
