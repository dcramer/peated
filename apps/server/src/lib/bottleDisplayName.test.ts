import { describe, expect, it } from "vitest";

import {
  formatBottleDisplayName,
  formatBottleLabel,
  getBottleReleaseMetadata,
} from "./bottleDisplayName";

const bottle = {
  name: "Glenburgie 38-year-old Chapter Thirty Two",
  group: { name: "Glenburgie 38-year-old Chapter Thirty Two" },
  brand: { name: "Decadent Drinks", shortName: null },
  series: { name: "Whiskyland" },
  edition: null,
  vintageYear: 1988,
  releaseYear: 2026,
};

const selectedCask = {
  name: "Clynelish 1972 - for La Maison du Whisky",
  brand: { name: "Gordon & MacPhail", shortName: null },
  series: { name: "The Dram Takers" },
  edition: "for La Maison du Whisky",
  vintageYear: 1972,
  statedAge: 37,
};

describe("formatBottleDisplayName", () => {
  it("formats one concise human-facing identity by default", () => {
    expect(formatBottleDisplayName(bottle)).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old Chapter Thirty Two",
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
      "Whiskyland Glenburgie 38-year-old Chapter Thirty Two",
    );
  });

  it("omits Brand and Series context inside a Series-owned list", () => {
    expect(
      formatBottleDisplayName(bottle, {
        includeBrand: false,
        includeSeries: false,
      }),
    ).toBe("Glenburgie 38-year-old Chapter Thirty Two");
  });

  it("keeps a selection edition out of the title", () => {
    expect(formatBottleDisplayName(selectedCask)).toBe(
      "Gordon & MacPhail The Dram Takers Clynelish 1972",
    );
    expect(
      formatBottleDisplayName({
        ...selectedCask,
        group: { name: "Clynelish 1972" },
      }),
    ).toBe("Gordon & MacPhail The Dram Takers Clynelish 1972");
    expect(getBottleReleaseMetadata(selectedCask)).toBe(
      "for La Maison du Whisky",
    );
  });

  it.each(["Batch C923", "9.3", "S2B13", "2026 Release"])(
    "keeps edition %s beside the bottle name",
    (edition) => {
      const editionBottle = {
        ...bottle,
        name: `Glenburgie 38-year-old - ${edition}`,
        group: undefined,
        series: null,
        edition,
      };

      expect(formatBottleDisplayName(editionBottle)).toBe(
        "Decadent Drinks Glenburgie 38-year-old",
      );
      expect(getBottleReleaseMetadata(editionBottle)).toBe(edition);
    },
  );

  it("keeps release wording that is part of the name", () => {
    expect(
      formatBottleDisplayName({
        name: "Port Ellen 1978 4th Release",
        brand: { name: "Port Ellen" },
        edition: "4th Release",
      }),
    ).toBe("Port Ellen Port Ellen 1978 4th Release");
  });

  it("preserves stable batch wording in the expression", () => {
    expect(
      formatBottleDisplayName({
        ...bottle,
        name: "Small Batch",
        group: { name: "Small Batch" },
        series: null,
      }),
    ).toBe("Decadent Drinks Small Batch");
  });

  it("does not repeat series wording", () => {
    expect(
      formatBottleDisplayName({
        name: "Exploration Series No. 1 Totara Cask",
        brand: { name: "Pōkeno" },
        series: { name: "Exploration Series" },
      }),
    ).toBe("Pōkeno Exploration Series No. 1 Totara Cask");
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
        edition: "Batch 24",
        releaseYear: 2026,
        vintageYear: 1988,
      }),
    ).toBe("Batch 24");
  });
});

describe("formatBottleLabel", () => {
  it("adds ABV so releases with the same name stay distinct", () => {
    expect(formatBottleLabel({ ...bottle, abv: 41.2 })).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old Chapter Thirty Two · 41.2%",
    );
  });

  it("shows the name alone when ABV is unknown", () => {
    expect(formatBottleLabel({ ...bottle, abv: null })).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old Chapter Thirty Two",
    );
  });

  it("does not repeat ABV already in the marketed name", () => {
    expect(
      formatBottleLabel({
        name: "Strength 57.1% ABV Edition",
        brand: { name: "Example" },
        abv: 57.1,
      }),
    ).toBe("Example Strength 57.1% ABV Edition");
  });
});
