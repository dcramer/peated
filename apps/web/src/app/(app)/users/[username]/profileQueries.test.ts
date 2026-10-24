import { describe, expect, test } from "vitest";

import {
  countProfileLibraryFilters,
  countProfileTastingFilters,
  getProfileActivityRouteState,
  getProfileLibraryInput,
  getProfileListView,
  getProfileTastingInput,
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
    expect(getProfileTastingInput({ cursor: "not-a-page" }, 42).cursor).toBe(1);
  });

  test("keeps only supported library filters", () => {
    expect(
      getProfileLibraryInput(
        {
          age: "atLeast25",
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
      age: "atLeast25",
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
          age: "ancient",
          brand: "-1",
          cursor: "0",
          distiller: "nan",
          sort: "invalid",
          status: "removed",
        },
        42,
      ),
    ).toEqual({
      age: undefined,
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

  test("keeps only supported tasting filters", () => {
    expect(
      getProfileTastingInput(
        new URLSearchParams({
          age: "from13To17",
          country: "scotland",
          cursor: "3",
          distiller: "9",
          entity: "7",
          internalRouteValue: "ignore-me",
          query: "brora",
          rating: "unicorn",
          region: "islay",
          sort: "-rating",
        }),
        42,
      ),
    ).toEqual({
      age: "from13To17",
      country: "scotland",
      cursor: 3,
      distiller: 9,
      entity: 7,
      limit: 25,
      query: "brora",
      ratingBand: "unicorn",
      region: "islay",
      sort: "-rating",
      user: 42,
    });
  });

  test("drops unsupported tasting filters and a region without a country", () => {
    expect(
      getProfileTastingInput(
        { age: "old", rating: "great", region: "islay", sort: "best" },
        42,
      ),
    ).toEqual({
      age: undefined,
      country: undefined,
      cursor: 1,
      distiller: undefined,
      entity: undefined,
      limit: 25,
      query: "",
      ratingBand: undefined,
      region: undefined,
      sort: "-created",
      user: 42,
    });
  });

  test("shows the list unless the table is requested", () => {
    expect(getProfileListView({ view: "table" })).toBe("table");
    expect(getProfileListView({ view: "grid" })).toBe("list");
    expect(getProfileListView({})).toBe("list");
  });

  test("counts only the filters a list applies", () => {
    expect(
      countProfileLibraryFilters(
        getProfileLibraryInput(
          { age: "under10", query: "islay", sort: "-created", view: "table" },
          42,
        ),
      ),
    ).toBe(2);
    expect(
      countProfileTastingFilters(
        getProfileTastingInput({ country: "scotland", region: "islay" }, 42),
      ),
    ).toBe(2);
  });

  test("does not count URL values the parser drops", () => {
    expect(
      countProfileLibraryFilters(
        getProfileLibraryInput({ brand: "abc", status: "bogus" }, 42),
      ),
    ).toBe(0);
    // A region without its country is dropped.
    expect(
      countProfileTastingFilters(
        getProfileTastingInput({ rating: "great", region: "islay" }, 42),
      ),
    ).toBe(0);
  });
});
