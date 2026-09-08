import { describe, expect, it } from "vitest";

import { getEntitySeriesInput } from "./entitySeriesParams";

describe("getEntitySeriesInput", () => {
  it("defaults to the most populated Series", () => {
    expect(getEntitySeriesInput(321, {})).toEqual({
      cursor: 1,
      distillery: 321,
      limit: 25,
      sort: "-bottles",
    });
  });

  it("keeps valid pagination and name sorting", () => {
    expect(getEntitySeriesInput(321, { cursor: "3", sort: "name" })).toEqual({
      cursor: 3,
      distillery: 321,
      limit: 25,
      sort: "name",
    });
  });

  it("drops unsupported query values", () => {
    expect(
      getEntitySeriesInput(321, { cursor: "nope", sort: "newest" }),
    ).toEqual({
      cursor: 1,
      distillery: 321,
      limit: 25,
      sort: "-bottles",
    });
  });
});
