import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";

type Client = RouterClient<Router>;
type ActivityClient = { activity: Pick<Client["activity"], "list"> };

export function getActivityFeedSelection(feed?: string) {
  return feed === "following" ? "following" : "everyone";
}

/** Falls back to public activity only when there are no accepted follows. */
export async function loadActivityFeed({
  following,
  memberClient,
  publicClient,
}: {
  following: boolean;
  memberClient?: ActivityClient & { friends: Pick<Client["friends"], "list"> };
  publicClient: ActivityClient & {
    externalReviews: Pick<Client["externalReviews"], "list">;
  };
}) {
  let note: string | undefined;

  if (following && memberClient) {
    const follows = await memberClient.friends.list({
      filter: "active",
      limit: 1,
    });
    if (follows.results.length) {
      const activity = await memberClient.activity.list({
        filter: "friends",
        limit: 20,
      });
      return {
        items: getCommunityFeedItems({
          criticReviews: [],
          activity: activity.results,
        }),
        note,
      };
    }
    note = "You're not following anyone yet. Showing everyone's activity.";
  } else if (following) {
    note = "Sign in to follow people. Showing everyone's activity.";
  }

  const [activity, reviews] = await Promise.all([
    publicClient.activity.list({ limit: 20 }),
    publicClient.externalReviews.list({ limit: 20, sort: "recent" }),
  ]);

  return {
    items: getCommunityFeedItems({
      criticReviews: reviews.results,
      activity: activity.results,
    }),
    note,
  };
}
