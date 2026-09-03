import { describe, expect, test } from "vitest";

import {
  getProfileActivityRouteState,
  getProfileLibraryInput,
  getProfileTastingCursor,
} from "./profileQueries";

describe("profile route query state", () => {
  test("uses the same activity state for server and browser params", () => {
    const expected = { cursor: "next-page", page: 3 };

    expect(
      getProfileActivityRouteState({ cursor: "next-page", page: "3" }),
    ).toEqual(expected);
    expect(
      getProfileActivityRouteState(
        new URLSearchParams({ cursor: "next-page", page: "3" }),
      ),
    ).toEqual(expected);
  });

  test("normalizes invalid page values", () => {
    expect(getProfileActivityRouteState({ page: "0" })).toEqual({
      cursor: undefined,
      page: 1,
    });
    expect(getProfileTastingCursor({ cursor: "not-a-page" })).toBe(1);
  });

  test("keeps only supported library filters", () => {
    expect(
      getProfileLibraryInput(
        {
          brand: "12",
          cursor: "2",
          distiller: "19",
          internalRouteValue: "ignore-me",
          query: "peated",
          sort: "-created",
          status: "open",
        },
        42,
      ),
    ).toEqual({
      brand: 12,
      collection: "library",
      cursor: 2,
      distiller: 19,
      limit: 25,
      query: "peated",
      sort: "-created",
      status: "open",
      user: 42,
    });
  });

  test("normalizes unsupported library filters", () => {
    expect(
      getProfileLibraryInput(
        {
          brand: "-1",
          cursor: "0",
          distiller: "nan",
          sort: "invalid",
          status: "removed",
        },
        42,
      ),
    ).toEqual({
      brand: undefined,
      collection: "library",
      cursor: 1,
      distiller: undefined,
      limit: 25,
      query: "",
      sort: "name",
      status: undefined,
      user: 42,
    });
  });

  test("uses the same library sort for server and browser params", () => {
    const params = { sort: "-created", query: "peated", cursor: "2" };
    expect(getProfileLibraryInput(new URLSearchParams(params), 42)).toEqual(
      getProfileLibraryInput(params, 42),
    );
    expect(getProfileLibraryInput({}, 42).sort).toBe("name");
  });
});
