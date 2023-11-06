import type {
  Collection,
  CollectionBottle,
  Paginated,
} from "@peated/core/types";
import type { ApiClient } from "~/lib/api";

type CollectionQueryParams = {
  bottle?: string | number;
  page?: string | number;
  sort?: string;
};

export async function fetchCollections(
  api: ApiClient,
  userId: number | string | "me" = "me",
  params: CollectionQueryParams,
): Promise<Paginated<Collection>> {
  return api.get(`/users/${userId}/collections`, {
    query: params,
  });
}

export async function fetchBottlesInCollection(
  api: ApiClient,
  userId: number | string | "me" = "me",
  collectionId = "default",
): Promise<Paginated<CollectionBottle>> {
  return api.get(`/users/${userId}/collections/${collectionId}/bottles`);
}

export async function favoriteBottle(
  api: ApiClient,
  bottleId: number | string,
) {
  await api.post(`/users/me/collections/default/bottles`, {
    data: {
      bottle: bottleId,
    },
  });
  return true;
}

export async function unfavoriteBottle(
  api: ApiClient,
  bottleId: number | string,
) {
  await api.delete(`/users/me/collections/default/bottles/${bottleId}`, {
    data: {
      bottle: bottleId,
    },
  });
  return false;
}
