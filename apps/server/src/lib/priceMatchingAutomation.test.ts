import { describe, expect, test } from "vitest";

import {
  getStorePriceMatchAutomationAssessment,
  hasSupportiveWebEvidenceForExistingMatch,
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

    expect(assessment.automationScore).toBeGreaterThanOrEqual(80);
    expect(assessment.decisiveMatchAttributes).toContain("abv");
    expect(assessment.decisiveMatchAttributes).toContain("statedAge");
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
});
