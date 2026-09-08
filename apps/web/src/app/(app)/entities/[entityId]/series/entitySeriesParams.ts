import type { Inputs } from "@peated/server/orpc/router";
import {
  getApiQueryParams,
  type SearchParamSource,
} from "@peated/web/lib/apiQueryParams";

export const entitySeriesSorts = ["-bottles", "name"] as const;

export function getEntitySeriesInput(
  distillery: number,
  searchParams: SearchParamSource,
): Inputs["bottleSeries"]["list"] {
  const params = getApiQueryParams(searchParams, {
    allowedValues: { sort: entitySeriesSorts },
    defaults: { cursor: 1, sort: "-bottles" },
    fields: ["cursor", "sort"],
    numericFields: ["cursor"],
  });

  return {
    cursor: Number(params.cursor),
    distillery,
    limit: 25,
    sort: params.sort,
  };
}
