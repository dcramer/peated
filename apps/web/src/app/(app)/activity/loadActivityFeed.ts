import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import { getAuthRedirect } from "@peated/web/lib/auth";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";

type Client = RouterClient<Router>;
type ActivityClient = { activity: Pick<Client["activity"], "list"> };

export function getActivityFeedSelection(feed?: string) {
  return feed === "following" ? "following" : "everyone";
}

export function requiresActivityFeedLogin({
  feed,
  isLoggedIn,
}: {
  feed: "everyone" | "following";
  isLoggedIn: boolean;
}) {
  return feed === "following" && !isLoggedIn;
}

export function getActivityFeedHref({
  feed,
  isLoggedIn,
}: {
  feed: "everyone" | "following";
  isLoggedIn: boolean;
}) {
  const href = `/activity?feed=${feed}`;

  return feed === "following" && !isLoggedIn
    ? getAuthRedirect({
        pathname: "/activity",
        searchParams: new URLSearchParams({ feed }),
      })
    : href;
}

/** Falls back to public activity only when there are no accepted follows. */
export async function loadActivityFeed({
  cursor,
  following,
  memberClient,
  publicClient,
}: {
  cursor?: string;
  following: boolean;
  memberClient?: ActivityClient & { friends: Pick<Client["friends"], "list"> };
  publicClient: ActivityClient;
}) {
  let note: string | undefined;

  if (following && memberClient) {
    const follows = await memberClient.friends.list({
      filter: "active",
      limit: 1,
    });
    if (follows.results.length) {
      const activity = await memberClient.activity.list({
        cursor,
        filter: "friends",
        limit: 20,
      });
      return {
        items: getCommunityFeedItems({
          criticReviews: [],
          activity: activity.results,
        }),
        note,
        rel: activity.rel,
      };
    }
    note = "You're not following anyone yet. Showing everyone's activity.";
  } else if (following) {
    note = "Sign in to follow people. Showing everyone's activity.";
  }

  const activity = await publicClient.activity.list({
    cursor,
    includeCriticReviews: true,
    limit: 20,
  });

  return {
    items: getCommunityFeedItems({
      criticReviews: [],
      activity: activity.results,
    }),
    note,
    rel: activity.rel,
  };
}
