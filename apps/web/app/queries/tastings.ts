import type { Paginated, Tasting } from "@peated/core/types";
import type { ApiClient } from "~/lib/api";

type TastingQueryParams = {
  bottle?: string | number;
  entity?: string | number;
  user?: string | number;
  page?: string | number;
  sort?: string;
};

export async function fetchTastings(
  api: ApiClient,
  params: TastingQueryParams,
): Promise<Paginated<Tasting>> {
  return api.get(`/tastings`, {
    query: params,
  });
}

export async function getTasting(
  api: ApiClient,
  tastingId: number | string,
): Promise<Tasting> {
  return api.get(`/tastings/${tastingId}`);
}
