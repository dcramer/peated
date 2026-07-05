import { describe, expect, test } from "vitest";

import {
  getStorePriceMatchAutomationAssessment,
  hasSupportiveWebEvidenceForExistingMatch,
  shouldVerifyStorePriceMatch,
} from "./priceMatchingAutomation";

type AssessmentInput = Parameters<
  typeof getStorePriceMatchAutomationAssessment
>[0];

function buildExtractedLabel(
  overrides: Partial<NonNullable<AssessmentInput["extractedLabel"]>> = {},
): NonNullable<AssessmentInput["extractedLabel"]> {
  return {
    brand: "Example Distillery",
    bottler: null,
    expression: "Port Cask",
    series: null,
    distillery: ["Example Distillery"],
    category: "single_malt",
    stated_age: 10,
    abv: 58.4,
    release_year: null,
    vintage_year: null,
    cask_type: "tawny_port",
    cask_size: null,
    cask_fill: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...overrides,
  };
}

function buildCandidate(
  overrides: Partial<AssessmentInput["candidateBottles"][number]> = {},
): AssessmentInput["candidateBottles"][number] {
  return {
    kind: "bottle",
    bottleId: 1,
    releaseId: null,
    alias: null,
    fullName: "Example Distillery Port Cask 10 Year",
    bottleFullName: "Example Distillery Port Cask 10 Year",
    brand: "Example Distillery",
    bottler: null,
    series: null,
    distillery: ["Example Distillery"],
    category: "single_malt",
    statedAge: 10,
    edition: null,
    caskStrength: null,
    singleCask: null,
    abv: 58.4,
    vintageYear: null,
    releaseYear: null,
    caskType: "tawny_port",
    caskSize: null,
    caskFill: null,
    score: 0.91,
    source: ["current", "vector"],
    ...overrides,
  };
}

describe("priceMatchingAutomation", () => {
  test("treats exact ABV as a decisive positive signal for strong existing matches", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 72,
      price: {
        bottleId: 1,
        name: "Example Distillery Port Cask 10 Year",
        url: "https://totalwine.com/example",
      },
      suggestedBottleId: 1,
      extractedLabel: buildExtractedLabel(),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [buildCandidate()],
    });

    expect(assessment.automationScore).toBe(72);
    expect(assessment.decisiveMatchAttributes).toContain("abv");
    expect(assessment.decisiveMatchAttributes).toContain("statedAge");
  });

  test("does not flag a stable age statement as release-specific when the bottle already markets it", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 88,
      price: {
        bottleId: 1,
        name: "The Whistler How The Years Whistle By 10-year-old Single Malt Irish Whiskey",
        url: "https://example.com/whistler",
      },
      suggestedBottleId: 1,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "The Whistler",
        expression: "How The Years Whistle By",
        distillery: ["The Whistler"],
        category: "single_malt",
        stated_age: 10,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 1,
          fullName:
            "The Whistler How The Years Whistle By 10-year-old Single Malt Irish Whiskey",
          bottleFullName:
            "The Whistler How The Years Whistle By 10-year-old Single Malt Irish Whiskey",
          brand: "The Whistler",
          distillery: ["The Whistler"],
          category: "single_malt",
          statedAge: 10,
          abv: null,
          caskType: null,
        }),
      ],
    });

    expect(assessment.automationBlockers).not.toContain(
      "listing looks release-specific but the suggested target is only a bottle",
    );
    expect(assessment.decisiveMatchAttributes).toContain("statedAge");
  });

  test("auto-approves high-confidence stable bottle matches from structured identity even below the raw score threshold", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 97,
      price: {
        bottleId: null,
        name: "The Macallan Double Cask 12-year-old Single Malt Whisky",
        url: "https://www.reservebar.com/example",
      },
      suggestedBottleId: 25,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "The Macallan",
        expression: "Double Cask",
        distillery: ["Macallan"],
        category: "single_malt",
        stated_age: 12,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 25,
          fullName: "The Macallan 12-year-old Double Cask",
          bottleFullName: "The Macallan 12-year-old Double Cask",
          brand: "The Macallan",
          bottler: "The Macallan",
          distillery: ["The Macallan"],
          category: "single_malt",
          statedAge: 12,
          abv: null,
          caskType: null,
          source: ["text", "brand"],
        }),
      ],
    });

    expect(assessment.automationScore).toBe(97);
    expect(assessment.structuredMatchRequiresStatedAge).toBe(true);
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 25,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: assessment.automationBlockers,
      }),
    ).toBe(true);
  });

  test("auto-approves high-confidence NAS bottle matches from structured identity", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 97,
      price: {
        bottleId: null,
        name: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
        url: "https://example.com/rare-breed-rye",
      },
      suggestedBottleId: 25,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Wild Turkey",
        expression: "Rare Breed",
        distillery: ["Wild Turkey"],
        category: "rye",
        stated_age: null,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 25,
          fullName: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
          bottleFullName:
            "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
          brand: "Wild Turkey",
          distillery: ["Wild Turkey"],
          category: "rye",
          statedAge: null,
          caskStrength: true,
          abv: null,
          caskType: null,
          source: ["text", "brand"],
        }),
      ],
    });

    expect(assessment.structuredMatchRequiresStatedAge).toBe(false);
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 25,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: assessment.automationBlockers,
      }),
    ).toBe(true);
  });

  test("does not let the legacy generic spirit category block a reviewed existing match", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 97,
      price: {
        bottleId: null,
        name: "Shibui Grain Select Whisky 750ml",
        url: "https://woodencork.com/products/shibui-grain-select-whisky",
      },
      suggestedBottleId: 13025,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Shibui",
        expression: "Grain Select",
        distillery: [],
        category: "single_grain",
        stated_age: null,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 13025,
          fullName: "Shibui Grain Select",
          bottleFullName: "Shibui Grain Select",
          brand: "Shibui",
          distillery: [],
          category: "spirit",
          statedAge: null,
          abv: null,
          caskType: null,
          source: ["brand", "exact"],
        }),
      ],
    });

    expect(assessment.automationBlockers).toEqual([]);
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 13025,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: assessment.automationBlockers,
      }),
    ).toBe(true);
  });

  test("records agent-supported external evidence for high-confidence bottle matches", () => {
    const extractedLabel = buildExtractedLabel({
      brand: "The Glenlivet",
      bottler: null,
      expression: "Caribbean Reserve",
      distillery: ["The Glenlivet"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      cask_type: null,
    });
    const target = buildCandidate({
      bottleId: 1760,
      fullName: "Glenlivet Caribbean Reserve Rum Barrel Selection",
      bottleFullName: "Glenlivet Caribbean Reserve Rum Barrel Selection",
      brand: "Glenlivet",
      bottler: "Glenlivet",
      distillery: [],
      category: "single_malt",
      statedAge: null,
      abv: null,
      caskType: null,
      score: 1,
      source: ["text"],
    });
    const searchEvidence = [
      {
        provider: "openai" as const,
        query: "The Glenlivet Caribbean Reserve official rum barrel selection",
        summary:
          "Official Glenlivet sources describe Caribbean Reserve as a single malt selectively finished in Caribbean rum casks.",
        results: [
          {
            title:
              "Caribbean Reserve Single Malt Scotch Whisky - The Glenlivet US",
            url: "https://www.theglenlivet.com/en-us/whisky/caribbean-reserve-single-malt-scotch/",
            domain: "theglenlivet.com",
            description:
              "The Glenlivet Caribbean Reserve is a single malt Scotch whisky selectively finished in Caribbean rum casks.",
            extraSnippets: [],
          },
        ],
      },
    ];
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 96,
      price: {
        bottleId: null,
        name: "The Glenlivet Caribbean Reserve",
        url: "https://www.reservebar.com/products/the-glenlivet-caribbean-reserve/GROUPING-1419170.html",
      },
      suggestedBottleId: 1760,
      suggestedReleaseId: null,
      extractedLabel,
      proposedBottle: null,
      searchEvidence,
      candidateBottles: [target],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationBlockers).toEqual([]);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "name"),
    ).toMatchObject({
      expectedValue: "Caribbean Reserve",
      validated: true,
      matchedSourceTiers: ["external"],
    });
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 1760,
        suggestedReleaseId: null,
        modelConfidence: 96,
        automationBlockers: assessment.automationBlockers,
      }),
    ).toBe(true);
  });

  test("does not auto-approve unmatched bottle matches below the elevated confidence threshold", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 25,
        suggestedReleaseId: null,
        modelConfidence: 95,
        automationBlockers: [],
      }),
    ).toBe(false);
  });

  test("auto-approves clear plain age-statement bottle matches as a deterministic judgement", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 35,
      price: {
        bottleId: null,
        name: "Springbank Aged 25-year-old",
        url: "https://woodencork.com/products/springbank-aged-25-year-old-750-ml",
      },
      suggestedBottleId: 469,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Springbank",
        expression: null,
        distillery: ["Springbank"],
        category: null,
        stated_age: 25,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 469,
          fullName: "Springbank 25-year-old",
          bottleFullName: "Springbank 25-year-old",
          brand: "Springbank",
          bottler: "Springbank",
          distillery: [],
          category: "single_malt",
          statedAge: 25,
          abv: null,
          caskType: null,
        }),
        buildCandidate({
          bottleId: 1563,
          fullName: "Springbank 25-year-old Limited Edition",
          bottleFullName: "Springbank 25-year-old Limited Edition",
          brand: "Springbank",
          bottler: "Springbank",
          distillery: [],
          category: "single_malt",
          statedAge: 25,
          abv: null,
          caskType: null,
          score: 1,
          source: ["text"],
        }),
      ],
    });

    expect(assessment.automationBlockers).toEqual([]);
    expect(assessment.plainAgeBottleAutoVerifyEligible).toBe(true);
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 469,
        suggestedReleaseId: null,
        modelConfidence: 35,
        automationBlockers: assessment.automationBlockers,
        plainAgeBottleAutoVerifyEligible:
          assessment.plainAgeBottleAutoVerifyEligible,
      }),
    ).toBe(true);
  });

  test("keeps release-specific plain-age listings out of plain-age auto-approval", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 93,
      price: {
        bottleId: null,
        name: "Springbank 25-year-old Limited Edition",
        url: "https://example.com/springbank-25-limited",
      },
      suggestedBottleId: 469,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Springbank",
        expression: null,
        distillery: ["Springbank"],
        category: null,
        stated_age: 25,
        edition: "Limited Edition",
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 469,
          fullName: "Springbank 25-year-old",
          bottleFullName: "Springbank 25-year-old",
          brand: "Springbank",
          bottler: "Springbank",
          distillery: [],
          category: "single_malt",
          statedAge: 25,
          abv: null,
          caskType: null,
        }),
      ],
    });

    expect(assessment.plainAgeBottleAutoVerifyEligible).toBe(false);
    expect(assessment.automationBlockers).toContain(
      "listing looks release-specific but the suggested target is only a bottle",
    );
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 469,
        suggestedReleaseId: null,
        modelConfidence: 93,
        automationBlockers: assessment.automationBlockers,
        plainAgeBottleAutoVerifyEligible:
          assessment.plainAgeBottleAutoVerifyEligible,
      }),
    ).toBe(false);
  });

  test("keeps the release-specific blocker when the bottle target does not represent the extracted edition", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 88,
      price: {
        bottleId: 2,
        name: "Springbank 12-year-old Cask Strength Batch 24",
        url: "https://example.com/springbank",
      },
      suggestedBottleId: 2,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Springbank",
        expression: "12-year-old Cask Strength",
        distillery: ["Springbank"],
        category: "single_malt",
        stated_age: 12,
        abv: null,
        cask_type: null,
        cask_strength: true,
        edition: "Batch 24",
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 2,
          fullName: "Springbank 12-year-old Cask Strength",
          bottleFullName: "Springbank 12-year-old Cask Strength",
          brand: "Springbank",
          distillery: ["Springbank"],
          category: "single_malt",
          statedAge: 12,
          abv: null,
          caskType: null,
          caskStrength: true,
        }),
      ],
    });

    expect(assessment.automationBlockers).toContain(
      "listing looks release-specific but the suggested target is only a bottle",
    );
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 2,
        suggestedReleaseId: null,
        modelConfidence: 99,
        automationBlockers: assessment.automationBlockers,
      }),
    ).toBe(false);
  });

  test("does not treat originating retailer evidence as decisive for auto-create", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Distillery Port Cask 10 Year",
        url: "https://www.totalwine.com/example",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel(),
      proposedBottle: {
        name: "Port Cask",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: 10,
        caskStrength: null,
        singleCask: null,
        abv: 58.4,
        vintageYear: null,
        releaseYear: null,
        caskType: "tawny_port",
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Distillery",
        },
        distillers: [
          {
            id: null,
            name: "Example Distillery",
          },
        ],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "openai",
          query: '"Example Distillery" "Tawny Port Finish" "58.4% ABV"',
          summary:
            "Total Wine lists Example Distillery Tawny Port Finish at 58.4% ABV.",
          results: [
            {
              title: "Example Distillery Tawny Port Finish",
              url: "https://www.totalwine.com/example",
              domain: "totalwine.com",
              description:
                "Total Wine lists Example Distillery Tawny Port Finish at 58.4% ABV.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 9,
          fullName: "Example Distillery 10 Year",
          abv: 46,
          caskType: null,
          score: 0.87,
          source: ["vector"],
        }),
      ],
    });

    expect(assessment.automationEligible).toBe(false);
    expect(assessment.automationScore).toBeLessThan(90);
    expect(assessment.automationBlockers).toEqual(
      expect.arrayContaining([
        "the originating retailer is not decisive evidence for auto-create",
      ]),
    );
    expect(
      assessment.webEvidenceChecks.find(
        (check) => check.attribute === "caskType",
      ),
    ).toMatchObject({
      validated: false,
      weaklySupported: true,
      matchedSourceTiers: expect.arrayContaining(["origin_retailer"]),
    });
  });

  test("allows auto-create when agent-supported external evidence validates differentiating traits", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Distillery Port Cask 10 Year",
        url: "https://www.totalwine.com/example",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel(),
      proposedBottle: {
        name: "Port Cask",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: 10,
        caskStrength: null,
        singleCask: null,
        abv: 58.4,
        vintageYear: null,
        releaseYear: null,
        caskType: "tawny_port",
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Distillery",
        },
        distillers: [
          {
            id: null,
            name: "Example Distillery",
          },
        ],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "openai",
          query: '"Example Distillery" "Tawny Port Finish" "58.4% ABV"',
          summary:
            "The official Example Distillery release page confirms a tawny port finished bottling at 58.4% ABV.",
          results: [
            {
              title: "Example Distillery Tawny Port Finish",
              url: "https://www.exampledistillery.com/port-cask",
              domain: "exampledistillery.com",
              description:
                "The official Example Distillery release page confirms a tawny port finished bottling at 58.4% ABV.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 9,
          fullName: "Example Distillery 10 Year",
          abv: 46,
          caskType: null,
          score: 0.87,
          source: ["vector"],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationEligible).toBe(true);
    expect(assessment.automationScore).toBeGreaterThanOrEqual(90);
    expect(assessment.automationBlockers).toEqual([]);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: true,
      matchedSourceTiers: expect.arrayContaining(["external"]),
    });
  });

  test("validates auto-create ABV evidence from exact US proof", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Distillery 12-year-old Single Barrel Bourbon",
        url: "https://shop.example/example-single-barrel-bourbon",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Example Distillery",
        expression: "Single Barrel",
        distillery: ["Example Distillery"],
        category: "bourbon",
        stated_age: 12,
        abv: 50,
        cask_type: null,
        single_cask: true,
      }),
      proposedBottle: {
        name: "12-year-old Single Barrel Bourbon",
        series: null,
        category: "bourbon",
        edition: null,
        statedAge: 12,
        caskStrength: null,
        singleCask: true,
        abv: 50,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Distillery",
        },
        distillers: [],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "firecrawl",
          query:
            "Example Distillery 12 Year Old Single Barrel Bourbon 100 proof",
          summary:
            "The producer confirms Example Distillery 12-Year-Old Single Barrel Bourbon. Proof: 100 Proof. Age: 12 Years Old.",
          results: [
            {
              title: "Example Distillery 12-Year-Old Single Barrel Bourbon",
              url: "https://www.exampledistillery.com/single-barrel-bourbon",
              domain: "exampledistillery.com",
              description:
                "Example Distillery 12-Year-Old Single Barrel Bourbon. Proof: 100 Proof. Age: 12 Years Old.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 16142,
          fullName:
            "Example Distillery 12-year-old Single Barrel Bourbon Select",
          bottleFullName:
            "Example Distillery 12-year-old Single Barrel Bourbon Select",
          brand: "Example Distillery",
          distillery: [],
          category: "bourbon",
          statedAge: 12,
          singleCask: true,
          abv: null,
          caskType: null,
          source: ["brand", "text"],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationEligible).toBe(true);
    expect(assessment.automationBlockers).toEqual([]);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: true,
      matchedSourceTiers: expect.arrayContaining(["external"]),
    });
  });

  test("does not convert numeric proof from bourbon cask context", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Distillery 10 Year",
        url: "https://shop.example/example-10",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel({
        abv: 35,
        cask_type: null,
      }),
      proposedBottle: {
        name: "10-year-old",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: 10,
        caskStrength: null,
        singleCask: null,
        abv: 35,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Distillery",
        },
        distillers: [
          {
            id: null,
            name: "Example Distillery",
          },
        ],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "openai",
          query: "Example Distillery 10 Year 70 proof",
          summary:
            "The official page describes Example Distillery 10 Year as a single malt finished in bourbon whiskey barrels at 70 proof.",
          results: [
            {
              title: "Example Distillery 10 Year",
              url: "https://www.exampledistillery.com/10-year",
              domain: "exampledistillery.com",
              description: "Example Distillery 10 Year is listed at 70 proof.",
              extraSnippets: ["Finished in bourbon whiskey barrels."],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 9,
          fullName: "Example Distillery 10 Year",
          abv: null,
          caskType: null,
          score: 0.87,
          source: ["vector"],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationEligible).toBe(false);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: false,
    });
  });

  test("does not convert numeric proof from Canadian rye wording", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Canadian Rye 10 Year",
        url: "https://shop.example/canadian-rye-10",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Example Canadian",
        expression: "Rye",
        distillery: ["Example Canadian"],
        category: "rye",
        stated_age: 10,
        abv: 35,
        cask_type: null,
      }),
      proposedBottle: {
        name: "Rye 10-year-old",
        series: null,
        category: "rye",
        edition: null,
        statedAge: 10,
        caskStrength: null,
        singleCask: null,
        abv: 35,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Canadian",
        },
        distillers: [
          {
            id: null,
            name: "Example Canadian",
          },
        ],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "openai",
          query: "Example Canadian Rye 10 Year 70 proof",
          summary:
            "The producer describes Example Canadian Rye 10 Year as a Canadian rye whisky at 70 proof.",
          results: [
            {
              title: "Example Canadian Rye 10 Year",
              url: "https://www.examplecanadian.com/rye-10",
              domain: "examplecanadian.com",
              description:
                "Example Canadian Rye 10 Year is a Canadian rye whisky at 70 proof.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 9,
          fullName: "Example Canadian Rye 10 Year",
          brand: "Example Canadian",
          distillery: [],
          category: "rye",
          statedAge: 10,
          abv: null,
          caskType: null,
          score: 0.87,
          source: ["vector"],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationEligible).toBe(false);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: false,
    });
  });

  test("does not infer numeric ABV from generic proof wording", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "create_new",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Example Distillery Barrel Proof 10 Year",
        url: "https://shop.example/barrel-proof",
      },
      suggestedBottleId: null,
      extractedLabel: buildExtractedLabel({
        abv: 45,
        cask_strength: true,
        cask_type: null,
      }),
      proposedBottle: {
        name: "Barrel Proof",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: 10,
        caskStrength: true,
        singleCask: null,
        abv: 45,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example Distillery",
        },
        distillers: [
          {
            id: null,
            name: "Example Distillery",
          },
        ],
        bottler: null,
      },
      searchEvidence: [
        {
          provider: "openai",
          query: "Example Distillery Barrel Proof",
          summary:
            "The official page describes Example Distillery Barrel Proof as a barrel proof 10 year release.",
          results: [
            {
              title: "Example Distillery Barrel Proof",
              url: "https://www.exampledistillery.com/barrel-proof",
              domain: "exampledistillery.com",
              description:
                "Example Distillery Barrel Proof is a barrel proof 10 year release.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        buildCandidate({
          bottleId: 9,
          fullName: "Example Distillery 10 Year",
          abv: null,
          caskStrength: null,
          caskType: null,
          score: 0.87,
          source: ["vector"],
        }),
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(assessment.automationEligible).toBe(false);
    expect(assessment.automationBlockers).toContain(
      "supportive external web evidence did not validate the differentiating bottle traits",
    );
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: false,
    });
  });

  test("treats agent-supported web evidence as support when it validates an omitted canonical trait", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      priceUrl: "https://shop.example/wild-turkey-rare-breed-rye",
      target: buildCandidate({
        fullName: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
        brand: "Wild Turkey",
        distillery: ["Wild Turkey"],
        category: "rye",
        statedAge: null,
        caskType: null,
        caskStrength: true,
      }),
      extractedLabel: buildExtractedLabel({
        brand: "Wild Turkey",
        expression: "Rare Breed",
        distillery: ["Wild Turkey"],
        category: "rye",
        stated_age: null,
        abv: null,
        cask_type: null,
      }),
      searchEvidence: [
        {
          provider: "openai",
          query: '"Wild Turkey Rare Breed Rye" barrel proof',
          summary:
            "Wild Turkey says Rare Breed Rye is bottled at barrel proof. Rare Bird 101 also describes Rare Breed Rye as Wild Turkey's barrel-proof rye.",
          results: [
            {
              title:
                "What is Rye Whiskey & What Makes it So Special? | Wild Turkey",
              url: "https://www.wildturkeybourbon.com/en-us/latest-news/what-is-rye-whiskey/",
              domain: "wildturkeybourbon.com",
              description:
                "Wild Turkey Rare Breed Rye is bottled at barrel proof.",
              extraSnippets: [],
            },
            {
              title: "Rare Breed Rye (2024) – Rare Bird 101",
              url: "https://rarebird101.com/2024/04/24/rare-breed-rye-2024/",
              domain: "rarebird101.com",
              description:
                "Rare Bird 101 describes Rare Breed Rye as the brand's barrel-proof rye.",
              extraSnippets: [],
            },
          ],
        },
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(supported).toBe(true);
  });

  test("does not treat web evidence as supportive when it confirms only the generic parent and not the missing edition", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      priceUrl: "https://shop.example/glenmorangie-quinta-ruban-14",
      target: buildCandidate({
        fullName: "Glenmorangie 14-year-old Quinta Ruban - 4th Edition",
        brand: "Glenmorangie",
        distillery: ["Glenmorangie"],
        statedAge: 14,
        edition: "4th Edition",
        caskType: null,
        abv: 46,
      }),
      extractedLabel: buildExtractedLabel({
        brand: "Glenmorangie",
        expression: "Quinta Ruban",
        distillery: ["Glenmorangie"],
        category: "single_malt",
        stated_age: 14,
        abv: null,
        cask_type: null,
        edition: null,
      }),
      searchEvidence: [
        {
          provider: "openai",
          query: '"Glenmorangie Quinta Ruban 14 Years Old"',
          summary:
            "Glenmorangie's official page confirms The Quinta Ruban 14 Years Old at 46% ABV.",
          results: [
            {
              title: "Glenmorangie The Quinta Ruban 14 Years Old",
              url: "https://www.glenmorangie.com/en-us/products/the-quinta-ruban",
              domain: "glenmorangie.com",
              description:
                "The official Glenmorangie page confirms Quinta Ruban 14 Years Old at 46% ABV.",
              extraSnippets: [],
            },
          ],
        },
      ],
      webEvidenceJudgment: "supportive",
    });

    expect(supported).toBe(false);
  });

  test("does not auto-approve unmatched matches from downstream score alone", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 86,
        automationBlockers: [],
      }),
    ).toBe(false);
  });

  test("auto-approves the current assignment at the lower confidence threshold", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: 1,
        currentReleaseId: null,
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 80,
        automationBlockers: [],
      }),
    ).toBe(true);
  });

  test("auto-approves unmatched bottle matches when classifier confidence reaches the elevated threshold", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 96,
        automationBlockers: [],
      }),
    ).toBe(true);
  });

  test("does not auto-approve unmatched bottle matches below the elevated threshold even when the title is clear", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 13437,
        suggestedReleaseId: null,
        modelConfidence: 95,
        automationBlockers: [],
      }),
    ).toBe(false);
  });

  test("auto-approves exact-cask code matches at the exact-cask threshold", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        identityScope: "exact_cask",
        suggestedBottleId: 41,
        suggestedReleaseId: null,
        modelConfidence: 95,
        automationBlockers: [],
      }),
    ).toBe(true);
  });

  test("does not auto-approve unmatched release matches from confidence alone", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 1,
        suggestedReleaseId: 10,
        modelConfidence: 100,
        automationBlockers: [],
      }),
    ).toBe(false);
  });

  test("does not auto-approve existing matches with automation blockers", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        currentBottleId: null,
        currentReleaseId: null,
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 99,
        automationBlockers: ["candidate age conflicts with extracted label"],
      }),
    ).toBe(false);
  });
});
