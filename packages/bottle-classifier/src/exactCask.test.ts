import { describe, expect, test } from "vitest";
import type { BottleCandidate } from "./classifierTypes";
import {
  getCandidateMarketedCaskCodeAnchor,
  getExactCaskCodeAnchor,
  getMarketedCaskCodeAnchor,
} from "./exactCask";

describe("exact cask code anchors", () => {
  test("extracts valid exact-cask codes", () => {
    expect(getExactCaskCodeAnchor("SMWS RW6.5 Sauna Smoke 58.1%")).toBe(
      "RW6.5",
    );
    expect(getExactCaskCodeAnchor("SMWS 54.2 Bright orchard fruit")).toBe(
      "54.2",
    );
  });

  test("ignores measurement lookalikes", () => {
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2% ABV")).toBeNull();
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2 ABV")).toBeNull();
    expect(getExactCaskCodeAnchor("SMWS single cask 54.2 proof")).toBeNull();
  });
});

describe("marketed cask code anchors", () => {
  const candidate = (overrides: Partial<BottleCandidate>): BottleCandidate => ({
    bottleId: 1,
    reference: null,
    fullName: "Example",
    brand: "Example",
    bottler: null,
    series: null,
    distillery: [],
    category: "bourbon",
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    maturation: null,
    caskNumber: null,
    outturn: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    score: 1,
    source: ["text"],
    ...overrides,
  });

  test("extracts explicit barrel and cask identifiers", () => {
    expect(getMarketedCaskCodeAnchor("French Oak (Barrel F2-038)")).toBe(
      "F2-038",
    );
    expect(getMarketedCaskCodeAnchor("Single Cask No. 1661")).toBe("1661");
    expect(
      getMarketedCaskCodeAnchor("Example Single Barrel Barrel No. 4769"),
    ).toBe("4769");
    expect(getMarketedCaskCodeAnchor("4769", { allowBareCode: true })).toBe(
      "4769",
    );
  });

  test("does not turn release, batch, age, or strength wording into cask codes", () => {
    expect(getMarketedCaskCodeAnchor("Cask Strength No. 5")).toBeNull();
    expect(getMarketedCaskCodeAnchor("Barrel Strength Batch 11")).toBeNull();
    expect(getMarketedCaskCodeAnchor("Single Barrel 18-year-old")).toBeNull();
    expect(getMarketedCaskCodeAnchor("Laphroaig Elements 2.0")).toBeNull();
    expect(getMarketedCaskCodeAnchor("Octomore 13.1")).toBeNull();
  });

  test("recognizes dotted codes only in an exact-cask program context", () => {
    expect(
      getMarketedCaskCodeAnchor("SMWS RW6.5", { allowProgramCode: true }),
    ).toBe("RW6.5");
    expect(
      getCandidateMarketedCaskCodeAnchor(
        candidate({ fullName: "SMWS RW6.5", brand: "SMWS" }),
      ),
    ).toBe("RW6.5");
    expect(
      getCandidateMarketedCaskCodeAnchor(
        candidate({ fullName: "Laphroaig Elements 2.0" }),
      ),
    ).toBeNull();
  });

  test("uses a standalone number only for a candidate identified as single-cask", () => {
    expect(
      getCandidateMarketedCaskCodeAnchor(
        candidate({
          fullName: "Example Single Barrel 18-year-old (No. 4040)",
          singleCask: true,
        }),
      ),
    ).toBe("4040");
    expect(
      getCandidateMarketedCaskCodeAnchor(
        candidate({ fullName: "Example Cask Strength No. 5" }),
      ),
    ).toBeNull();
  });
});
