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
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 25,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: assessment.automationBlockers,
        decisiveMatchAttributes: assessment.decisiveMatchAttributes,
        structuredMatchRequiresStatedAge:
          assessment.structuredMatchRequiresStatedAge,
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
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 25,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: assessment.automationBlockers,
        decisiveMatchAttributes: assessment.decisiveMatchAttributes,
        structuredMatchRequiresStatedAge:
          assessment.structuredMatchRequiresStatedAge,
        candidateBottles: [
          buildCandidate({
            bottleId: 25,
            fullName:
              "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
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
      }),
    ).toBe(true);
  });

  test("does not auto-approve plain age-statement bottles from high confidence alone", () => {
    const assessment = getStorePriceMatchAutomationAssessment({
      action: "match_existing",
      modelConfidence: 95,
      price: {
        bottleId: null,
        name: "Tomatin Single Malt 12-year-old",
        url: "https://example.com/tomatin",
      },
      suggestedBottleId: 12,
      suggestedReleaseId: null,
      extractedLabel: buildExtractedLabel({
        brand: "Tomatin",
        expression: null,
        distillery: ["Tomatin"],
        category: "single_malt",
        stated_age: 12,
        abv: null,
        cask_type: null,
      }),
      proposedBottle: null,
      searchEvidence: [],
      candidateBottles: [
        buildCandidate({
          bottleId: 12,
          fullName: "Tomatin 12-year-old",
          bottleFullName: "Tomatin 12-year-old",
          brand: "Tomatin",
          distillery: ["Tomatin"],
          category: "single_malt",
          statedAge: 12,
          abv: null,
          caskType: null,
        }),
      ],
    });

    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 12,
        suggestedReleaseId: null,
        modelConfidence: 95,
        automationBlockers: assessment.automationBlockers,
        decisiveMatchAttributes: assessment.decisiveMatchAttributes,
        structuredMatchRequiresStatedAge:
          assessment.structuredMatchRequiresStatedAge,
        candidateBottles: [
          buildCandidate({
            bottleId: 12,
            fullName: "Tomatin 12-year-old",
            bottleFullName: "Tomatin 12-year-old",
            brand: "Tomatin",
            distillery: ["Tomatin"],
            category: "single_malt",
            statedAge: 12,
            abv: null,
            caskType: null,
          }),
        ],
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

  test("allows auto-create when authoritative evidence validates differentiating traits", () => {
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
    });

    expect(assessment.automationEligible).toBe(true);
    expect(assessment.automationScore).toBeGreaterThanOrEqual(90);
    expect(assessment.automationBlockers).toEqual([]);
    expect(
      assessment.webEvidenceChecks.find((check) => check.attribute === "abv"),
    ).toMatchObject({
      validated: true,
      matchedSourceTiers: expect.arrayContaining(["official"]),
    });
  });

  test("treats critic or official web evidence as support when it validates an omitted canonical trait", () => {
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
    });

    expect(supported).toBe(false);
  });

  test("does not auto-approve unmatched matches from downstream score alone", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 86,
        automationBlockers: [],
        decisiveMatchAttributes: [],
        candidateBottles: [buildCandidate()],
      }),
    ).toBe(false);
  });

  test("auto-approves the current assignment when an exact alias reaffirms it", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        price: {
          bottleId: 1,
          releaseId: null,
        },
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 72,
        automationBlockers: [],
        decisiveMatchAttributes: [],
        candidateBottles: [
          buildCandidate({
            source: ["current", "exact"],
          }),
        ],
      }),
    ).toBe(true);
  });

  test("auto-approves unmatched exact matches when classifier confidence is very high", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 97,
        automationBlockers: [],
        decisiveMatchAttributes: [],
        candidateBottles: [
          buildCandidate({
            source: ["exact"],
          }),
        ],
      }),
    ).toBe(true);
  });

  test("does not auto-approve unmatched exact matches when blockers remain", () => {
    expect(
      shouldVerifyStorePriceMatch({
        action: "match_existing",
        price: {
          bottleId: null,
          releaseId: null,
        },
        suggestedBottleId: 1,
        suggestedReleaseId: null,
        modelConfidence: 99,
        automationBlockers: ["candidate age conflicts with extracted label"],
        decisiveMatchAttributes: [],
        candidateBottles: [
          buildCandidate({
            source: ["exact"],
          }),
        ],
      }),
    ).toBe(false);
  });
});
