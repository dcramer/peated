import {
  BOTTLE_AGE_BAND_LIST,
  BOTTLE_LIST_SORT_OPTIONS,
  CATEGORY_LIST,
  FLAVOR_PROFILES,
} from "@peated/server/constants";

import type { ApiQueryParams } from "./apiQueryParams";

export const BOTTLE_CATALOG_QUERY_FIELDS = [
  "age",
  "ageBand",
  "brand",
  "bottler",
  "category",
  "cursor",
  "distiller",
  "entity",
  "filter",
  "flavorProfile",
  "flight",
  "limit",
  "minScore",
  "query",
  "series",
  "sort",
  "tag",
] as const;

export const BOTTLE_CATALOG_ALLOWED_VALUES = {
  ageBand: BOTTLE_AGE_BAND_LIST,
  category: CATEGORY_LIST,
  filter: ["all", "following"],
  flavorProfile: FLAVOR_PROFILES,
  // Keep old catalog URLs usable after rating was renamed to score.
  sort: [...BOTTLE_LIST_SORT_OPTIONS, "rating", "-rating"],
} as const;

export function normalizeBottleCatalogQueryParams(
  queryParams: ApiQueryParams,
): ApiQueryParams {
  if (queryParams.sort === "rating") {
    return { ...queryParams, sort: "score" };
  }
  if (queryParams.sort === "-rating") {
    return { ...queryParams, sort: "-score" };
  }
  return queryParams;
}
