import { expect, test } from "vitest";

import { getApiQueryParams } from "./apiQueryParams";

test("keeps only named query fields", () => {
  expect(
    getApiQueryParams(
      {
        cursor: "2",
        internalRouteValue: "123",
        sort: "name",
      },
      {
        fields: ["cursor", "sort"],
        numericFields: ["cursor"],
      },
    ),
  ).toEqual({ cursor: 2, sort: "name" });
});

test("uses the default for an unknown allowed value", () => {
  expect(
    getApiQueryParams(
      { sort: "removed-sort" },
      {
        defaults: { sort: "name" },
        allowedValues: { sort: ["name", "-name"] },
      },
    ),
  ).toEqual({ sort: "name" });
});
