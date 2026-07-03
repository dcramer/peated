import { describe, expect, it } from "vitest";

import { getCreateBottleHref } from "./createBottleHref";

describe("search result create bottle links", () => {
  it("targets the Create Bottle route for missing bottles", () => {
    expect(getCreateBottleHref({ query: "peated reserve" })).toBe(
      "/bottles/new?name=Peated+Reserve",
    );
  });

  it("preserves tasting intent for missing bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "peated reserve",
        returnAction: "tasting",
      }),
    ).toBe("/bottles/new?name=Peated+Reserve&returnAction=tasting");
  });

  it("preserves add bottle intent for missing bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "peated reserve",
        returnAction: "addBottle",
      }),
    ).toBe("/bottles/new?name=Peated+Reserve&returnAction=addBottle");
  });
});
