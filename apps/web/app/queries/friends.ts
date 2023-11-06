import type { Friend, Paginated } from "@peated/core/types";
import type { ApiClient } from "~/lib/api";

export async function fetchFriends(api: ApiClient): Promise<Paginated<Friend>> {
  return api.get("/friends");
}
