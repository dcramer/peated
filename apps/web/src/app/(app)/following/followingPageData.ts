import type { EntityKind } from "@peated/server/types";

export type FollowingPageSearchParams = Record<
  string,
  string | string[] | undefined
>;
export type FollowingType = "all" | "brand" | "bottler" | "distillery";
export type FollowingView = "find" | "following";

const followableKinds = [
  "brand",
  "bottler",
  "distillery",
] as const satisfies readonly EntityKind[];
const sortValues = ["name", "-created", "-tastings"] as const;

export function getFollowingPageState(params: FollowingPageSearchParams) {
  const view: FollowingView =
    readParam(params, "view") === "find" ? "find" : "following";
  const type = parseType(readParam(params, "type"));
  const query = readParam(params, "query").trim();
  const cursor = parseCursor(readParam(params, "cursor"));
  const requestedSort = readParam(params, "sort");
  const sort = isSortValue(requestedSort) ? requestedSort : "name";
  const kinds: EntityKind[] = type === "all" ? [...followableKinds] : [type];

  return {
    cursor,
    hasFilters: Boolean(query || type !== "all"),
    input: {
      cursor,
      filter: view === "following" ? "following" : "all",
      kinds,
      limit: 50,
      query,
      sort,
    } as const,
    query,
    sort,
    type,
    view,
  };
}

function readParam(params: FollowingPageSearchParams, name: string) {
  const value = params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseType(value: string): FollowingType {
  return value === "brand" || value === "bottler" || value === "distillery"
    ? value
    : "all";
}

function parseCursor(value: string) {
  const cursor = Number.parseInt(value, 10);
  return Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
}

function isSortValue(value: string): value is (typeof sortValues)[number] {
  return sortValues.some((sort) => sort === value);
}
