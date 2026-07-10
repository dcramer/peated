import { describe, expect, it } from "vitest";

import { formatBottleBottlingName } from "./bottlings";

describe("formatBottleBottlingName", () => {
  it("uses concise bottling fields instead of canonical trait suffixes", () => {
    expect(
      formatBottleBottlingName(
        { fullName: "A.D. Rattray Glenrothes" },
        {
          edition: "Individual Cask Release",
          releaseYear: 2021,
          vintageYear: 1997,
          fullName:
            "A.D. Rattray Glenrothes - Individual Cask Release - 23-year-old - 2021 Release - 1997 Vintage - Single Cask - Cask Strength",
        },
      ),
    ).toBe(
      "A.D. Rattray Glenrothes - Individual Cask Release (2021) (1997 Vintage)",
    );
  });

  it("removes canonical trait suffixes when no concise fields exist", () => {
    expect(
      formatBottleBottlingName(
        { fullName: "Laphroaig Single Cask Selection" },
        {
          edition: null,
          releaseYear: null,
          vintageYear: null,
          fullName:
            "Laphroaig Single Cask Selection - Fortunato's Folly - 54.1% ABV - Single Cask - Cask Strength",
        },
      ),
    ).toBe("Laphroaig Single Cask Selection - Fortunato's Folly - 54.1% ABV");
  });
});
