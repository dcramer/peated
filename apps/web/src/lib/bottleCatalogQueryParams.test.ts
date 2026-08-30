import { expect, test } from "vitest";

import { normalizeBottleCatalogQueryParams } from "./bottleCatalogQueryParams";

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
