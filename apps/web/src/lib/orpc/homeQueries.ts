import type { Outputs } from "@peated/server/orpc/router";
import {
  infiniteQueryOptions,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";

import type { ORPCQueryUtils } from "./context";

type ActivityFilter = "friends" | "global" | "local";
type ActivityList = Outputs["activity"]["list"];

export const publicHomeQueries = {
  stats: (orpc: ORPCQueryUtils) => orpc.stats.queryOptions(),
  events: (orpc: ORPCQueryUtils) =>
    orpc.events.list.queryOptions({
      input: { limit: 1, onlyUpcoming: true, sort: "date" },
    }),
  memberTastings: (orpc: ORPCQueryUtils) =>
    orpc.tastings.list.queryOptions({
      input: { limit: 3 },
    }),
  releases: (orpc: ORPCQueryUtils) =>
    orpc.bottles.list.queryOptions({
      input: { limit: 5, sort: "-release" },
    }),
  recentReviews: (orpc: ORPCQueryUtils) =>
    orpc.externalReviews.list.queryOptions({
      input: { limit: 3, sort: "recent" },
    }),
  countries: (orpc: ORPCQueryUtils) =>
    orpc.countries.list.queryOptions({
      input: { hasBottles: true, limit: 100, sort: "-bottles" },
    }),
  regions: (orpc: ORPCQueryUtils) =>
    orpc.regions.list.queryOptions({
      input: {
        country: "scotland",
        hasBottles: true,
        limit: 6,
        sort: "-bottles",
      },
    }),
  distilleries: (orpc: ORPCQueryUtils) =>
    orpc.distilleries.list.queryOptions({
      input: { limit: 5, sort: "-bottles" },
    }),
  recentBottles: (orpc: ORPCQueryUtils) =>
    orpc.bottles.list.queryOptions({
      input: { limit: 3, sort: "-created" },
    }),
};

export const memberHomeQueries = {
  activity: (orpc: ORPCQueryUtils, filter: ActivityFilter) =>
    infiniteQueryOptions<
      ActivityList,
      Error,
      InfiniteData<ActivityList>,
      QueryKey,
      string | undefined
    >({
      queryKey: orpc.activity.list.key({
        input: { filter, limit: 10 },
      }),
      queryFn: ({ pageParam }) =>
        orpc.activity.list.call({
          cursor: pageParam,
          filter,
          limit: 10,
        }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.rel.nextCursor ?? undefined,
    }),
  criticReviews: (orpc: ORPCQueryUtils) =>
    orpc.externalReviews.list.queryOptions({
      input: { limit: 2, sort: "recent" },
    }),
  followedReleases: (orpc: ORPCQueryUtils) =>
    orpc.bottles.list.queryOptions({
      input: { filter: "following", limit: 5, sort: "-release" },
    }),
  member: (orpc: ORPCQueryUtils) =>
    orpc.users.details.queryOptions({ input: { user: "me" } }),
  tastingStats: (orpc: ORPCQueryUtils) =>
    orpc.users.tastingStats.queryOptions({ input: { user: "me" } }),
};
