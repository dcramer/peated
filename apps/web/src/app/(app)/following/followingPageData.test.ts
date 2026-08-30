import { describe, expect, test } from "vitest";

import { getFollowingPageState } from "./followingPageData";

describe("getFollowingPageState", () => {
  test("defaults to all followed records", () => {
    expect(getFollowingPageState({})).toMatchObject({
      cursor: 1,
      hasFilters: false,
      input: {
        filter: "following",
        kinds: ["brand", "bottler", "distillery"],
        sort: "name",
      },
      type: "all",
      view: "following",
    });
  });

  test("builds a filtered find query", () => {
    expect(
      getFollowingPageState({
        cursor: "2",
        query: "  Ardbeg  ",
        sort: "-tastings",
        type: "distillery",
        view: "find",
      }),
    ).toMatchObject({
      cursor: 2,
      hasFilters: true,
      input: {
        filter: "all",
        kinds: ["distillery"],
        query: "Ardbeg",
        sort: "-tastings",
      },
      type: "distillery",
      view: "find",
    });
  });
});
