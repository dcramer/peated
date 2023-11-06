import type { Paginated, Tag, User } from "@peated/server/types";
import type { ApiClient } from "~/lib/api";

type UserQueryParams = {
  page?: string | number;
  sort?: string;
};

export async function fetchUsers(
  api: ApiClient,
  params: UserQueryParams,
): Promise<Paginated<User>> {
  return api.get(`/users`, {
    query: params,
  });
}

export async function getUser(
  api: ApiClient,
  userId: number | string | "me" = "me",
): Promise<
  User & {
    stats: {
      bottles: number;
      tastings: number;
      contributions: number;
      collected: number;
    };
  }
> {
  return api.get(`/users/${userId}`);
}

export async function fetchUserTags(
  api: ApiClient,
  userId: number | string | "me" = "me",
): Promise<Paginated<Tag> & { totalCount: number }> {
  return api.get(`/users/${userId}/tags`);
}
