import { describe, expect, it } from "vitest";

import { getAddAnotherReleasePath, getAddBottleHref } from "./addBottle";

describe("getAddAnotherReleasePath", () => {
  it("builds the canonical independent-release path", () => {
    expect(getAddAnotherReleasePath(123)).toBe("/bottles/123/addRelease");
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

  it("never serializes legacy release or group identity", () => {
    const legacyOptions = {
      bottleId: 42,
      flightId: "flight-qa",
      intent: "tasting",
      releaseId: 84,
      groupId: 21,
    } as const;

    expect(getAddBottleHref(legacyOptions)).toBe(
      "/addBottle?bottle=42&flight=flight-qa&intent=tasting",
    );
  });
});
