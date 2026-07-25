import { describe, expect, it } from "vitest";
import { formatBottleGroupOptionName } from "./bottleGroupField";

describe("formatBottleGroupOptionName", () => {
  it("disambiguates same-name release families with the representative Bottle", () => {
    expect(
      formatBottleGroupOptionName({
        fullName: "Springbank 12-year-old Cask Strength",
        representativeBottleId: 123,
        totalBottles: 2,
      }),
    ).toBe(
      "Springbank 12-year-old Cask Strength · representative Bottle 123 (2 releases)",
    );
  });
});
