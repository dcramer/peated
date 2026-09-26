import { describe, expect, test } from "vitest";

import { assessStorePriceMatch } from "./priceMatchingAutomation";

type AssessmentInput = Parameters<typeof assessStorePriceMatch>[0];

function buildExtractedLabel(
  overrides: Partial<NonNullable<AssessmentInput["sourceBottleIdentity"]>> = {},
): NonNullable<AssessmentInput["sourceBottleIdentity"]> {
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
    maturation: "Tawny port butt",
    cask_number: null,
    outturn: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...overrides,
  };
}

function buildCandidate(
  overrides: Partial<AssessmentInput["candidates"][number]> = {},
): AssessmentInput["candidates"][number] {
  return {
    bottleId: 1,
    reference: null,
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
    maturation: "Tawny port butt",
    caskNumber: null,
    outturn: null,
    score: 0.91,
    source: ["current", "vector"],
    ...overrides,
  };
}

function buildProposedBottle(
  overrides: Partial<NonNullable<AssessmentInput["proposedBottle"]>> = {},
): NonNullable<AssessmentInput["proposedBottle"]> {
  return {
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
    maturation: null,
    caskNumber: null,
    outturn: null,
    brand: { id: null, name: "Example Distillery" },
    distillers: [{ id: null, name: "Example Distillery" }],
    bottler: null,
    ...overrides,
  };
}

function assess(overrides: Partial<AssessmentInput> = {}) {
  return assessStorePriceMatch({
    action: "create_new",
    price: { bottleId: null },
    suggestedBottleId: null,
    candidates: [],
    proposedBottle: buildProposedBottle(),
    identityScope: "product",
    sourceBottleIdentity: null,
    hasUnresolvedRisks: false,
    webEvidence: "supportive",
    readListingImage: false,
    ...overrides,
  });
}

describe("assessStorePriceMatch", () => {
  test("applies a create backed by supportive web evidence", () => {
    expect(assess()).toEqual({
      automationEligible: true,
      automationBlockers: [],
    });
  });

  test("applies a create read from the listing's own label image", () => {
    expect(
      assess({ webEvidence: "not_used", readListingImage: true }),
    ).toMatchObject({ automationEligible: true });
  });

  test("applies a create backed by complete structured scraper facts", () => {
    expect(
      assess({
        webEvidence: "not_used",
        sourceBottleIdentity: buildExtractedLabel({ expression: "Port Cask" }),
      }),
    ).toMatchObject({ automationEligible: true });
  });

  test("reviews a create with no supporting evidence", () => {
    expect(assess({ webEvidence: "not_used" })).toEqual({
      automationEligible: false,
      automationBlockers: ["the classifier found no supporting evidence"],
    });
  });

  test("reviews any decision the classifier marked with a risk", () => {
    expect(
      assess({ hasUnresolvedRisks: true, readListingImage: true }),
    ).toEqual({
      automationEligible: false,
      automationBlockers: ["the classifier reported unresolved risks"],
    });
  });

  test("reviews a create that contradicts the store's structured facts", () => {
    expect(
      assess({ sourceBottleIdentity: buildExtractedLabel({ abv: 46 }) }),
    ).toEqual({
      automationEligible: false,
      automationBlockers: ["conflicts with the store's product facts (abv)"],
    });
  });

  test("ignores free-text differences in the store's structured facts", () => {
    expect(
      assess({
        sourceBottleIdentity: buildExtractedLabel({
          brand: "Example",
          distillery: ["Another Name"],
        }),
      }),
    ).toMatchObject({ automationEligible: true });
  });

  test("verifies a match the classifier judged needs no web research", () => {
    expect(
      assess({
        action: "match_existing",
        suggestedBottleId: 1,
        candidates: [buildCandidate()],
        proposedBottle: null,
        webEvidence: "not_needed",
      }),
    ).toMatchObject({ automationEligible: true });
  });

  test("reviews a match that replaces the listing's current Bottle", () => {
    expect(
      assess({
        action: "correction",
        price: { bottleId: 2 },
        suggestedBottleId: 1,
        candidates: [buildCandidate()],
        proposedBottle: null,
      }),
    ).toEqual({
      automationEligible: false,
      automationBlockers: ["it replaces the listing's current Bottle"],
    });
  });

  test("reviews a match whose Bottle was not a reviewed candidate", () => {
    expect(
      assess({
        action: "match_existing",
        suggestedBottleId: 99,
        candidates: [buildCandidate()],
        proposedBottle: null,
      }),
    ).toEqual({
      automationEligible: false,
      automationBlockers: [
        "the matched Bottle was not among the reviewed candidates",
      ],
    });
  });

  test("never applies a No Match", () => {
    expect(assess({ action: "no_match", proposedBottle: null })).toEqual({
      automationEligible: false,
      automationBlockers: [],
    });
  });
});
