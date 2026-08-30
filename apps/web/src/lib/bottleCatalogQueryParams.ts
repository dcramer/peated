import type { ApiQueryParams } from "./apiQueryParams";

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
