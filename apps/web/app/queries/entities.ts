import type { Entity, EntityType, Paginated } from "@peated/server/types";
import type { ApiClient } from "~/lib/api";

type EntityQueryParams = {
  country?: string;
  region?: string;
  type?: EntityType;
  page?: string | number;
  sort?: string;
};

export async function fetchEntities(
  api: ApiClient,
  params: EntityQueryParams,
): Promise<Paginated<Entity>> {
  return api.get(`/entities`, {
    query: params,
  });
}

export async function getEntity(
  api: ApiClient,
  entityId: number | string,
): Promise<
  Entity & {
    avgRating: number;
    people: number;
  }
> {
  return api.get(`/entities/${entityId}`);
}

type EntityCategory = {
  category: string;
  count: number;
};

export async function fetchEntityCategories(
  api: ApiClient,
  entityId: number | string,
): Promise<
  Paginated<EntityCategory> & {
    totalCount: number;
  }
> {
  return api.get(`/entities/${entityId}/categories`);
}
