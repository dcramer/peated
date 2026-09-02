import { describe, expect, it } from "vitest";

import { getRegionMap } from "./locationMap";

describe("getRegionMap", () => {
  it("selects Islay's own map", () => {
    expect(getRegionMap("scotland", "islay")).toEqual({
      kind: "region",
      slug: "scotland/islay",
    });
  });

  it("selects US state maps", () => {
    expect(getRegionMap("united-states", "kentucky")).toEqual({
      kind: "state",
      slug: "kentucky",
    });
  });

  it("omits unavailable maps instead of using the parent country", () => {
    expect(getRegionMap("scotland", "speyside")).toBeNull();
    expect(getRegionMap("ireland", "islay")).toBeNull();
  });
});
