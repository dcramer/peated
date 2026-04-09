import { describe, expect, test } from "vitest";
import {
  getExistingMatchIdentityConflicts,
  hasSupportiveWebEvidenceForExistingMatch,
} from "./bottleClassificationEvidence";
import type { BottleCandidate, BottleSearchEvidence } from "./index";

function buildBottleCandidate(
  candidate: Pick<BottleCandidate, "bottleId" | "fullName"> &
    Partial<BottleCandidate>,
): BottleCandidate {
  return {
    kind: "bottle",
    releaseId: null,
    alias: null,
    bottleFullName: candidate.fullName,
    brand: null,
    bottler: null,
    series: null,
    distillery: [],
    category: null,
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
    score: null,
    source: [],
    ...candidate,
  };
}

function buildSearchEvidence(
  evidence: Partial<BottleSearchEvidence>,
): BottleSearchEvidence {
  return {
    provider: "openai",
    query: "test query",
    summary: null,
    results: [],
    ...evidence,
  };
}

describe("bottleClassificationEvidence", () => {
  test("does not treat a more specific authoritative result title as support for a looser near-match", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 1,
      fullName: "Wild Turkey Rare Breed Barrel Proof",
      brand: "Wild Turkey",
      category: "bourbon",
      caskStrength: true,
    });
    const searchEvidence = [
      buildSearchEvidence({
        summary:
          "Wild Turkey confirms Rare Breed Barrel Proof is part of the lineup.",
        results: [
          {
            title: "Wild Turkey Rare Breed Rye Barrel Proof",
            url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
            domain: "wildturkeybourbon.com",
            description:
              "Official Wild Turkey page for Rare Breed Rye Barrel Proof.",
            extraSnippets: [],
          },
        ],
      }),
    ];

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/rare-breed-rye",
        searchEvidence,
        extractedLabel: null,
        targetCandidate,
      }),
    ).toBe(false);
  });

  test("treats an authoritative title-level name match as supportive evidence", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 2,
      fullName: "Ardbeg Uigeadail",
      brand: "Ardbeg",
      distillery: ["Ardbeg"],
      category: "single_malt",
    });
    const searchEvidence = [
      buildSearchEvidence({
        results: [
          {
            title: "Ardbeg Uigeadail Single Malt Scotch Whisky",
            url: "https://www.ardbeg.com/en-gb/whiskies/uigeadail",
            domain: "ardbeg.com",
            description: "Official Ardbeg page for Uigeadail.",
            extraSnippets: [],
          },
        ],
      }),
    ];

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/ardbeg-uigeadail",
        searchEvidence,
        extractedLabel: null,
        targetCandidate,
      }),
    ).toBe(true);
  });

  test("does not treat a differing age as a hard conflict for dirty parent bottle candidates", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 2457,
      fullName: "Glenglassaugh 1978 Rare Cask Release",
      brand: "Glenglassaugh",
      distillery: ["Glenglassaugh"],
      category: "single_malt",
      statedAge: 40,
    });

    expect(
      getExistingMatchIdentityConflicts({
        referenceName:
          "Glenglassaugh 1978 Rare Cask Release (Batch 1) 35-year-old",
        extractedLabel: {
          brand: "Glenglassaugh",
          bottler: null,
          expression: "1978 Rare Cask Release",
          series: null,
          distillery: ["Glenglassaugh"],
          category: "single_malt",
          stated_age: 35,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: "Batch 1",
        },
        targetCandidate,
      }),
    ).not.toContain("stated_age");
  });
});
