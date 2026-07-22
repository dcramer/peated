import { describe, expect, it } from "vitest";

import { getAddBottleHref } from "./addBottle";

describe("getAddBottleHref", () => {
  it("builds a route without catalog identity", () => {
    expect(getAddBottleHref({ intent: "tasting" })).toBe(
      "/addBottle?intent=tasting",
    );
  });

  it("builds an exact-catalog route from a legacy Bottle pair", () => {
    expect(
      getAddBottleHref({
        bottleId: 42,
        releaseId: 84,
        intent: "tasting",
      }),
    ).toBe("/addBottle?bottle=42&release=84&intent=tasting");
  });

  it("builds a generic-catalog route from a BottleGroup", () => {
    expect(
      getAddBottleHref({
        groupId: 21,
        flightId: "flight-qa",
        intent: "tasting",
      }),
    ).toBe("/addBottle?group=21&flight=flight-qa&intent=tasting");
  });

  it.each([
    { bottleId: 42, groupId: 21 },
    { releaseId: 84, groupId: 21 },
  ])("rejects mixed exact and generic catalog identity", (identity) => {
    expect(() =>
      getAddBottleHref(
        // @ts-expect-error Mixed exact and generic identity must stay invalid.
        identity,
      ),
    ).toThrow(
      "Add Bottle links cannot select both exact and generic catalog identity.",
    );
  });

  it("rejects a release without its Bottle identity", () => {
    expect(() =>
      // @ts-expect-error A legacy release is meaningful only with its Bottle.
      getAddBottleHref({
        releaseId: 84,
      }),
    ).toThrow("Add Bottle release links require a Bottle identity.");
  });
});
