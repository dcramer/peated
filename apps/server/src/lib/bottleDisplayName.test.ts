import { describe, expect, it } from "vitest";

import { formatBottleDisplayName } from "./bottleDisplayName";

const bottle = {
  name: "Glenburgie 38-year-old",
  group: { name: "Glenburgie 38-year-old" },
  brand: { name: "Decadent Drinks", shortName: null },
  series: { name: "Whiskyland" },
  edition: "Chapter Thirty Two",
  vintageYear: 1988,
  releaseYear: 2026,
};

describe("formatBottleDisplayName", () => {
  it("formats one concise human-facing identity by default", () => {
    expect(formatBottleDisplayName(bottle)).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old - Chapter Thirty Two",
    );
  });

  it("removes stored facts from the marketed name", () => {
    expect(
      formatBottleDisplayName({
        name: "Tun 89 Teaspooned Malt - 36-year-old - 2026 Release - 1989 Vintage - 52.4% ABV",
        brand: { name: "Milroy's of Soho" },
        statedAge: 36,
        releaseYear: 2026,
        vintageYear: 1989,
        abv: 52.4,
      }),
    ).toBe("Milroy's of Soho Tun 89 Teaspooned Malt");
  });

  it("omits brand context when the layout already shows it", () => {
    expect(formatBottleDisplayName(bottle, { includeBrand: false })).toBe(
      "Whiskyland Glenburgie 38-year-old - Chapter Thirty Two",
    );
  });

  it("uses at most one year when no marketed release marker exists", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        edition: null,
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old - 1988 Vintage");
  });

  it("does not add a release year already used as the edition", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        vintageYear: null,
        edition: "2026 Release",
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old - 2026 Release");
  });

  it("does not repeat series or release wording", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        name: "Exploration Series No. 1 - Chapter Thirty Two",
        group: undefined,
        brand: { name: "Pōkeno" },
        series: { name: "Exploration Series" },
      }),
    ).toBe("Pōkeno Exploration Series No. 1 - Chapter Thirty Two");
  });
});
