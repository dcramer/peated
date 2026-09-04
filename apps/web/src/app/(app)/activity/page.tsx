import { CursorPager, PageTabs } from "@peated/web/components";
import { ActivityPage } from "@peated/web/components/pages/activityPage.stylex";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import {
  getAnonymousServerClient,
  getServerClient,
} from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";
import {
  getActivityFeedHref,
  getActivityFeedSelection,
  loadActivityFeed,
} from "./loadActivityFeed";

export const metadata: Metadata = {
  title: "Activity",
  description:
    "Recent whisky tastings, reviews, and library additions on Peated.",
};

export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedSearchParams, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const feed = getFirstValue(resolvedSearchParams.feed);
  const cursor = getFirstValue(resolvedSearchParams.cursor);
  const page = getPageNumber(getFirstValue(resolvedSearchParams.page));
  const selectedFeed = getActivityFeedSelection(feed);
  const following = selectedFeed === "following";
  const { client: publicClient } = await getAnonymousServerClient();
  const memberClient = user ? (await getServerClient()).client : undefined;
  const [{ items, note, rel }, library] = await Promise.all([
    loadActivityFeed({ cursor, following, memberClient, publicClient }),
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
      ...toBottleListItem(item.bottle),
      imageUrl: item.imageUrl ?? item.bottle.imageUrl,
    }));

  return (
    <ActivityPage
      items={items}
      libraryBottles={libraryBottles}
      libraryHref={user ? `/users/${user.username}/library` : undefined}
      note={note}
      pagination={
        <CursorPager
          ariaLabel="Activity pages"
          nextHref={getCursorHref(
            "/activity",
            resolvedSearchParams,
            rel.nextCursor,
            { page: page + 1 },
          )}
          page={page}
          previousHref={getCursorHref(
            "/activity",
            resolvedSearchParams,
            rel.prevCursor,
            { page: Math.max(1, page - 1) },
          )}
        />
      }
      selector={
        <PageTabs
          ariaLabel="Activity feeds"
          currentHref={`/activity?feed=${selectedFeed}`}
          items={[
            {
              href: getActivityFeedHref({
                feed: "following",
                isLoggedIn: Boolean(user),
              }),
              label: "Following",
            },
            {
              href: getActivityFeedHref({
                feed: "everyone",
                isLoggedIn: Boolean(user),
              }),
              label: "Everyone",
            },
          ]}
        />
      }
    />
  );
}

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPageNumber(value?: string) {
  if (!value) return 1;
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
