import { describe, expect, test } from "vitest";
import {
  getExistingMatchIdentityConflicts,
  hasDirtyParentStatedAgeConflict,
  hasSupportiveWebEvidenceForExistingMatch,
} from "./bottleClassificationEvidence";
import type { BottleCandidate, BottleSearchEvidence } from "./classifierTypes";

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

  test("treats authoritative brand-led evidence as support for a distillery-qualified plain age-statement bottle", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3233,
      fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
      brand: "Jura",
      distillery: ["Isle of Jura"],
      category: "single_malt",
      statedAge: 12,
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/jura-12-year-old",
        searchEvidence: [
          buildSearchEvidence({
            summary:
              "Jura's official site confirms the 12 Year Old single malt Scotch whisky.",
            results: [
              {
                title: "Jura 12 Year Old | Single Malt Scotch Whisky",
                url: "https://www.jurawhisky.com/us/all-whisky/signature-series/12-year-old/",
                domain: "jurawhisky.com",
                description:
                  "Official Jura product page for the 12 Year Old single malt Scotch whisky.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: {
          brand: "Jura",
          bottler: null,
          expression: null,
          series: null,
          distillery: ["Jura"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate,
      }),
    ).toBe(true);
  });

  test("requires the extracted identity to include the same stated age before plain age evidence counts as support", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3233,
      fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
      brand: "Jura",
      distillery: ["Isle of Jura"],
      category: "single_malt",
      statedAge: 12,
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/jura-single-malt",
        searchEvidence: [
          buildSearchEvidence({
            summary:
              "Jura's official site confirms the 12 Year Old single malt Scotch whisky.",
            results: [
              {
                title: "Jura 12 Year Old | Single Malt Scotch Whisky",
                url: "https://www.jurawhisky.com/us/all-whisky/signature-series/12-year-old/",
                domain: "jurawhisky.com",
                description:
                  "Official Jura product page for the 12 Year Old single malt Scotch whisky.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: {
          brand: "Jura",
          bottler: null,
          expression: null,
          series: null,
          distillery: ["Jura"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate,
      }),
    ).toBe(false);
  });

  test("does not treat plain age evidence as support for a release-qualified extracted identity", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3233,
      fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
      brand: "Jura",
      distillery: ["Isle of Jura"],
      category: "single_malt",
      statedAge: 12,
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/jura-12-batch-4",
        searchEvidence: [
          buildSearchEvidence({
            summary:
              "Jura's official site confirms the 12 Year Old single malt Scotch whisky.",
            results: [
              {
                title: "Jura 12 Year Old | Single Malt Scotch Whisky",
                url: "https://www.jurawhisky.com/us/all-whisky/signature-series/12-year-old/",
                domain: "jurawhisky.com",
                description:
                  "Official Jura product page for the 12 Year Old single malt Scotch whisky.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: {
          brand: "Jura",
          bottler: null,
          expression: null,
          series: null,
          distillery: ["Jura"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: "Batch 4",
        },
        targetCandidate,
      }),
    ).toBe(false);
  });

  test("does not treat plain age evidence as support when the extracted identity carries extra cask detail", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3233,
      fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
      brand: "Jura",
      distillery: ["Isle of Jura"],
      category: "single_malt",
      statedAge: 12,
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/jura-12-sherry-cask",
        searchEvidence: [
          buildSearchEvidence({
            summary:
              "Jura's official site confirms the 12 Year Old single malt Scotch whisky.",
            results: [
              {
                title: "Jura 12 Year Old | Single Malt Scotch Whisky",
                url: "https://www.jurawhisky.com/us/all-whisky/signature-series/12-year-old/",
                domain: "jurawhisky.com",
                description:
                  "Official Jura product page for the 12 Year Old single malt Scotch whisky.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: {
          brand: "Jura",
          bottler: null,
          expression: null,
          series: null,
          distillery: ["Jura"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: "oloroso",
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate,
      }),
    ).toBe(false);
  });

  test("does not treat plain age evidence as support for a named sibling expression", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3234,
      fullName: "Jura 12-year-old Sherry Cask Single Malt Scotch Whisky",
      brand: "Jura",
      distillery: ["Isle of Jura"],
      category: "single_malt",
      statedAge: 12,
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/jura-12-year-old",
        searchEvidence: [
          buildSearchEvidence({
            summary:
              "Jura's official site confirms the 12 Year Old single malt Scotch whisky.",
            results: [
              {
                title: "Jura 12 Year Old | Single Malt Scotch Whisky",
                url: "https://www.jurawhisky.com/us/all-whisky/signature-series/12-year-old/",
                domain: "jurawhisky.com",
                description:
                  "Official Jura product page for the 12 Year Old single malt Scotch whisky.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: {
          brand: "Jura",
          bottler: null,
          expression: null,
          series: null,
          distillery: ["Jura"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate,
      }),
    ).toBe(false);
  });

  test("does not treat origin-retailer titles as independent authoritative support", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 3,
      fullName: "Ardbeg Uigeadail",
      brand: "Ardbeg",
      distillery: ["Ardbeg"],
      category: "single_malt",
    });

    expect(
      hasSupportiveWebEvidenceForExistingMatch({
        sourceUrl: "https://shop.example/products/ardbeg-uigeadail",
        searchEvidence: [
          buildSearchEvidence({
            results: [
              {
                title: "Ardbeg Uigeadail Single Malt Scotch Whisky",
                url: "https://shop.example/products/ardbeg-uigeadail",
                domain: "shop.example",
                description: "Origin retailer listing for Ardbeg Uigeadail.",
                extraSnippets: [],
              },
            ],
          }),
        ],
        extractedLabel: null,
        targetCandidate,
      }),
    ).toBe(false);
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

  test("does not treat the legacy generic spirit category as a hard existing-match conflict", () => {
    expect(
      getExistingMatchIdentityConflicts({
        referenceName: "Shibui Grain Select Whisky 750ml",
        extractedLabel: {
          brand: "Shibui",
          bottler: null,
          expression: "Grain Select",
          series: null,
          distillery: [],
          category: "single_grain",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate: buildBottleCandidate({
          bottleId: 13025,
          fullName: "Shibui Grain Select",
          bottleFullName: "Shibui Grain Select",
          brand: "Shibui",
          category: "spirit",
          source: ["brand", "exact"],
        }),
      }),
    ).not.toContain("category");
  });

  test("flags dirty parent stated-age conflicts only when the bottle name does not market that age", () => {
    expect(
      hasDirtyParentStatedAgeConflict({
        targetCandidate: buildBottleCandidate({
          bottleId: 11,
          fullName: "Maker's Mark Private Selection",
          bottleFullName: "Maker's Mark Private Selection",
          statedAge: 10,
        }),
        extractedLabel: {
          brand: "Maker's Mark",
          bottler: null,
          expression: "Private Selection",
          series: null,
          distillery: ["Maker's Mark"],
          category: "bourbon",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      }),
    ).toBe(true);

    expect(
      hasDirtyParentStatedAgeConflict({
        targetCandidate: buildBottleCandidate({
          bottleId: 12,
          fullName: "Springbank 10yo",
          bottleFullName: "Springbank 10yo",
          statedAge: 10,
        }),
        extractedLabel: {
          brand: "Springbank",
          bottler: null,
          expression: "10yo",
          series: null,
          distillery: ["Springbank"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      }),
    ).toBe(false);
  });

  test("treats compact marketed ages like 10yo as a real stated-age conflict", () => {
    const targetCandidate = buildBottleCandidate({
      bottleId: 10,
      fullName: "Springbank 10yo",
      bottleFullName: "Springbank 10yo",
      brand: "Springbank",
      distillery: ["Springbank"],
      category: "single_malt",
      statedAge: 10,
      source: ["exact"],
    });

    expect(
      getExistingMatchIdentityConflicts({
        referenceName: "Springbank 12-year-old",
        extractedLabel: {
          brand: "Springbank",
          bottler: null,
          expression: "10yo",
          series: null,
          distillery: ["Springbank"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        targetCandidate,
      }),
    ).toContain("stated_age");
  });
});
