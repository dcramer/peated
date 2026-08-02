import { describe, expect, it } from "vitest";

import { getAddBottleHref, getAddSimilarBottlePath } from "./addBottle";

describe("getAddSimilarBottlePath", () => {
  it("builds the independent similar-Bottle path", () => {
    expect(getAddSimilarBottlePath(123)).toBe("/bottles/123/addRelease");
  });
});

describe("getAddBottleHref", () => {
  it("builds a route without catalog identity", () => {
    expect(getAddBottleHref({ intent: "tasting" })).toBe(
      "/addBottle?intent=tasting",
    );
  });

  it("builds a direct Bottle route", () => {
    expect(
      getAddBottleHref({
        bottleId: 42,
        intent: "tasting",
      }),
    ).toBe("/addBottle?bottle=42&intent=tasting");
  });

  it("marks a created Bottle result", () => {
    expect(
      getAddBottleHref({
        bottleId: 42,
        resultSource: "created",
      }),
    ).toBe("/addBottle?bottle=42&resultSource=created&intent=addBottle");
  });

  it("serializes the supported Bottle and return context", () => {
    const options = {
      bottleId: 42,
      flightId: "flight-qa",
      intent: "tasting",
    } as const;

    expect(getAddBottleHref(options)).toBe(
      "/addBottle?bottle=42&flight=flight-qa&intent=tasting",
    );
  });
});
