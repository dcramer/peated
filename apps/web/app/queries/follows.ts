import type { Follow, Paginated } from "@peated/shared/types";
import type { ApiClient } from "~/lib/api";

export async function fetchFollowing(
  api: ApiClient,
): Promise<Paginated<Follow>> {
  return api.get("/following");
}

export async function fetchFollowers(
  api: ApiClient,
): Promise<Paginated<Follow>> {
  return api.get("/followers");
}
