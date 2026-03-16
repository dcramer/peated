import { describe, expect, test } from "vitest";

import { getStorePriceMatchAutomationAssessment } from "./priceMatchingAutomation";

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
    bottleId: 1,
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
});
