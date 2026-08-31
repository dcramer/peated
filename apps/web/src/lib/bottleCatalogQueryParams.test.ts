import { expect, test } from "vitest";

import { getApiQueryParams } from "./apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "./bottleCatalogQueryParams";

test.each([
  ["rating", "score"],
  ["-rating", "-score"],
  ["-tastings", "-tastings"],
])("normalizes the bottle sort %s to %s", (sort, expected) => {
  expect(
    normalizeBottleCatalogQueryParams({
      category: "single_malt",
      sort,
    }),
  ).toEqual({
    category: "single_malt",
    sort: expected,
  });
});

test("keeps old bottle URLs valid and removes internal route fields", () => {
  const queryParams = getApiQueryParams(
    {
      nxtPentityId: "3023",
      sort: "-rating",
    },
    {
      defaults: { sort: "-release" },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
    },
  );

  expect(normalizeBottleCatalogQueryParams(queryParams)).toEqual({
    sort: "-score",
  });
});
