import { describe, expect, it } from "vitest";
import {
  getBottleContextLabel,
  getBottlePlainTextIdentity,
} from "./bottleLabel";

const bottle = {
  name: "Glenburgie 38-year-old",
  group: { name: "Glenburgie 38-year-old" },
  brand: { name: "Decadent Drinks", shortName: null },
  series: { name: "Whiskyland" },
  edition: "Chapter Thirty Two",
  vintageYear: 1988,
  releaseYear: 2026,
};

describe("bottle text labels", () => {
  it("includes nonduplicative series in contextual identity", () => {
    expect(getBottleContextLabel(bottle)).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old",
    );
  });

  it("uses the marketed release marker instead of chronology", () => {
    expect(getBottlePlainTextIdentity(bottle)).toBe(
      "Decadent Drinks Whiskyland Glenburgie 38-year-old - Chapter Thirty Two",
    );
  });

  it("does not repeat series wording already present in the expression", () => {
    expect(
      getBottleContextLabel({
        ...bottle,
        name: "Exploration Series No. 1 Totara Cask",
        group: { name: "Exploration Series No. 1 Totara Cask" },
        brand: { name: "Pōkeno" },
        series: { name: "Exploration Series" },
      }),
    ).toBe("Pōkeno Exploration Series No. 1 Totara Cask");
  });

  it("uses one chronology field when no release marker exists", () => {
    expect(
      getBottlePlainTextIdentity({
        ...bottle,
        edition: null,
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old - 1988 Vintage");
    expect(
      getBottlePlainTextIdentity({
        ...bottle,
        edition: null,
        vintageYear: null,
      }),
    ).toBe("Decadent Drinks Whiskyland Glenburgie 38-year-old - 2026 Release");
  });
});
