import {
  AGE_BUCKET_IDS,
  RATING_BAND_IDS,
  type AgeBucketId,
  type RatingBandId,
} from "@peated/server/constants";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import {
  infiniteQueryOptions,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";

import type { SearchParamSource } from "@peated/web/lib/apiQueryParams";
import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";

type ActivityList = Outputs["users"]["activity"]["list"];
export type ProfileLibraryInput = Inputs["collections"]["bottles"]["list"] & {
  brand?: number;
  collection: "library";
  cursor: number;
  distiller?: number;
  entity?: number;
  limit: 25;
  query: string;
  sort: "name" | "-created";
  status?: "empty" | "open" | "sealed" | "unset";
  user: number;
};

export type ProfileTastingInput = Inputs["tastings"]["list"] & {
  age?: AgeBucketId;
  country?: string;
  cursor: number;
  entity?: number;
  limit: 25;
  query: string;
  ratingBand?: RatingBandId;
  region?: string;
  sort: "-created" | "-rating" | "name";
  user: number;
};
export type ProfileTastingView = "list" | "table";

/** The server and browser must use the same query keys. */
export const profileQueries = {
  activity: (orpc: ORPCQueryUtils, userId: number, cursor?: string) =>
    infiniteQueryOptions<
      ActivityList,
      Error,
      InfiniteData<ActivityList>,
      QueryKey,
      string | undefined
    >({
      queryKey: orpc.users.activity.list.key({
        input: { cursor, limit: 10, user: userId },
      }),
      queryFn: ({ pageParam }) =>
        orpc.users.activity.list.call({
          cursor: pageParam,
          limit: 10,
          user: userId,
        }),
      initialPageParam: cursor,
      getNextPageParam: (lastPage) => lastPage.rel.nextCursor ?? undefined,
    }),
  library: (orpc: ORPCQueryUtils, input: ProfileLibraryInput) =>
    orpc.collections.bottles.list.queryOptions({ input }),
  libraryStats: (orpc: ORPCQueryUtils, userId: number) =>
    orpc.users.libraryStats.queryOptions({ input: { user: userId } }),
  regions: (orpc: ORPCQueryUtils, userId: number) =>
    orpc.users.regionList.queryOptions({ input: { user: userId } }),
  tastingStats: (orpc: ORPCQueryUtils, userId: number) =>
    orpc.users.tastingStats.queryOptions({ input: { user: userId } }),
  tastings: (orpc: ORPCQueryUtils, input: ProfileTastingInput) =>
    orpc.tastings.list.queryOptions({ input }),
};

export function getProfileActivityRouteState(source: SearchParamSource) {
  const cursor = getSearchParam(source, "cursor");
  const page = parsePositiveNumber(getSearchParam(source, "page"));

  return {
    cursor: cursor || undefined,
    page: page ?? 1,
  };
}

export function getProfileTastingInput(
  source: SearchParamSource,
  userId: number,
): ProfileTastingInput {
  const sort = getSearchParam(source, "sort");
  const country = getSearchParam(source, "country") || undefined;
  return {
    age: parseOption(getSearchParam(source, "age"), AGE_BUCKET_IDS),
    country,
    cursor: parsePositiveNumber(getSearchParam(source, "cursor")) ?? 1,
    entity: parsePositiveNumber(getSearchParam(source, "entity")),
    limit: 25,
    query: getSearchParam(source, "query") ?? "",
    ratingBand: parseOption(getSearchParam(source, "rating"), RATING_BAND_IDS),
    // The API rejects a region without its country.
    region: country ? getSearchParam(source, "region") || undefined : undefined,
    sort: sort === "-rating" || sort === "name" ? sort : "-created",
    user: userId,
  };
}

export function getProfileTastingView(
  source: SearchParamSource,
): ProfileTastingView {
  return getSearchParam(source, "view") === "table" ? "table" : "list";
}

export function getProfileLibraryInput(
  source: SearchParamSource,
  userId: number,
): ProfileLibraryInput {
  return {
    brand: parsePositiveNumber(getSearchParam(source, "brand")),
    collection: "library",
    cursor: parsePositiveNumber(getSearchParam(source, "cursor")) ?? 1,
    distiller: parsePositiveNumber(getSearchParam(source, "distiller")),
    entity: parsePositiveNumber(getSearchParam(source, "entity")),
    limit: 25,
    query: getSearchParam(source, "query") ?? "",
    sort: getSearchParam(source, "sort") === "-created" ? "-created" : "name",
    status: parseLibraryStatus(getSearchParam(source, "status")),
    user: userId,
  };
}

function getSearchParam(source: SearchParamSource, name: string) {
  if (Symbol.iterator in source) {
    for (const [entryName, value] of source) {
      if (entryName === name) return value;
    }
    return undefined;
  }

  const value = source[name];
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOption<Option extends string>(
  value: string | undefined,
  options: readonly Option[],
) {
  return options.find((option) => option === value);
}

function parseLibraryStatus(value: string | undefined) {
  return value === "empty" ||
    value === "open" ||
    value === "sealed" ||
    value === "unset"
    ? value
    : undefined;
}
