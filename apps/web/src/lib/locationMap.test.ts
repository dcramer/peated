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
    expect(getRegionMap("scotland", "unknown")).toBeNull();
    expect(getRegionMap("ireland", "islay")).toBeNull();
    expect(getRegionMap("ireland", "highland")).toBeNull();
  });

  it.each(["highland", "speyside", "lowland", "campbeltown", "islands"])(
    "selects the Scottish %s map",
    (region) => {
      expect(getRegionMap("scotland", region)).toEqual({
        kind: "region",
        slug: `scotland/${region}`,
      });
    },
  );

  it("uses the Campbeltown map for the legacy catalog spelling", () => {
    expect(getRegionMap("scotland", "cambeltown")).toEqual(
      getRegionMap("scotland", "campbeltown"),
    );
  });
});
