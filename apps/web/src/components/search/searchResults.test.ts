import { describe, expect, it } from "vitest";

import { getBottleResultHref } from "./bottleResult";
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

  it("routes Add Bottle intent bottle rows through the Add Bottle flow", () => {
    expect(
      getBottleResultHref({
        bottleId: 123,
        addBottleIntent: "addBottle",
      }),
    ).toBe("/addBottle?bottle=123&intent=addBottle");
  });

  it("keeps the legacy tasting search shortcut for bottle rows", () => {
    expect(
      getBottleResultHref({
        bottleId: 123,
        directToTasting: true,
      }),
    ).toBe("/bottles/123/addTasting");
  });
});
