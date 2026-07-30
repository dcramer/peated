import { describe, expect, it } from "vitest";
import { getBottleDisplayName } from "./bottleDisplayName";

describe("getBottleDisplayName", () => {
  it("uses the stable expression when a group summary is available", () => {
    expect(
      getBottleDisplayName({
        fullName:
          "Pōkeno Single Cask 4-year-old - 55.8% ABV - Pedro Ximenez Cask",
        group: {
          fullName: "Pōkeno Single Cask 4-year-old",
        },
      }),
    ).toBe("Pōkeno Single Cask 4-year-old");
  });

  it("falls back to the exact name without a group summary", () => {
    expect(
      getBottleDisplayName({
        fullName: "Pōkeno Single Cask 4-year-old",
      }),
    ).toBe("Pōkeno Single Cask 4-year-old");
  });
});
