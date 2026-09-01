import { describe, expect, it } from "vitest";

import {
  formatBottleDisplayName,
  getBottleReleaseMetadata,
} from "./bottleDisplayName";

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

  it("keeps inferred years out of the bottle name", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        edition: null,
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old");
  });

  it("keeps a numbered batch beside the bottle name", () => {
    const batchedBottle = {
      ...bottle,
      edition: "Batch C923",
      vintageYear: null,
    };

    expect(formatBottleDisplayName(batchedBottle)).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old",
    );
    expect(getBottleReleaseMetadata(batchedBottle)).toBe("Batch C923");
  });

  it.each(["9.3", "S2B13"])(
    "renders compact edition code %s inline with the expression",
    (edition) => {
      expect(
        formatBottleDisplayName({
          ...bottle,
          edition,
        }),
      ).toBe(`Decadent Drinks Whiskyland Glenburgie 38-year-old ${edition}`);
    },
  );

  it("keeps a separator before a worded edition", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        edition: "2026 Release",
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old - 2026 Release");
  });

  it("preserves stable batch wording in the expression", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        name: "Small Batch",
        group: { name: "Small Batch" },
        edition: null,
        series: null,
      }),
    ).toBe("Decadent Drinks Small Batch");
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

  it("returns at most one supporting release fact", () => {
    expect(
      getBottleReleaseMetadata({
        edition: null,
        releaseYear: 2026,
        vintageYear: 1988,
      }),
    ).toBe("1988 vintage");
    expect(
      getBottleReleaseMetadata({
        edition: "Chapter Thirty Two",
        releaseYear: 2026,
        vintageYear: 1988,
      }),
    ).toBeNull();
  });
});
