import { describe, expect, test } from "vitest";
import type {
  BottleCandidate,
  BottleExtractedDetails,
  BottleSearchEvidence,
} from "./classifierTypes";
import {
  getExistingMatchIdentityConflicts,
  hasSupportiveWebEvidenceForExistingMatch,
  isExistingMatchConfidenceEligibleForVerification,
} from "./priceMatchingEvidence";

function buildExtractedLabel(
  overrides: Partial<BottleExtractedDetails> = {},
): BottleExtractedDetails {
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

describe("priceMatchingEvidence", () => {
  test("treats critic or official evidence as support when it validates an omitted canonical trait", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: "https://shop.example/wild-turkey-rare-breed-rye",
      target: buildBottleCandidate({
        bottleId: 1,
        fullName: "Wild Turkey Rare Breed Barrel-Proof Kentucky Straight Rye",
        brand: "Wild Turkey",
        distillery: ["Wild Turkey"],
        category: "rye",
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
        buildSearchEvidence({
          query: '"Wild Turkey Rare Breed Rye" barrel proof',
          summary:
            "Wild Turkey says Rare Breed Rye is bottled at barrel proof.",
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
          ],
        }),
      ],
    });

    expect(supported).toBe(true);
  });

  test("does not treat evidence as supportive when it confirms only the generic parent and not the missing edition", () => {
    const supported = hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: "https://shop.example/glenmorangie-quinta-ruban-14",
      target: buildBottleCandidate({
        bottleId: 2,
        fullName: "Glenmorangie 14-year-old Quinta Ruban - 4th Edition",
        brand: "Glenmorangie",
        distillery: ["Glenmorangie"],
        statedAge: 14,
        edition: "4th Edition",
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
        buildSearchEvidence({
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
        }),
      ],
    });

    expect(supported).toBe(false);
  });

  test("reports material candidate conflicts from extracted identity", () => {
    expect(
      getExistingMatchIdentityConflicts({
        target: buildBottleCandidate({
          bottleId: 3,
          fullName: "Example Distillery Port Cask 10 Year",
          brand: "Example Distillery",
          distillery: ["Example Distillery"],
          category: "single_malt",
          statedAge: 12,
          abv: 46,
        }),
        extractedLabel: buildExtractedLabel({
          stated_age: 10,
          abv: 58.4,
        }),
      }),
    ).toEqual(
      expect.arrayContaining([
        "candidate ABV materially conflicts with extracted label",
      ]),
    );
  });

  test("does not treat the legacy generic spirit category as an existing-match conflict", () => {
    expect(
      getExistingMatchIdentityConflicts({
        target: buildBottleCandidate({
          bottleId: 13025,
          fullName: "Shibui Grain Select",
          bottleFullName: "Shibui Grain Select",
          brand: "Shibui",
          category: "spirit",
          source: ["brand", "exact"],
        }),
        extractedLabel: buildExtractedLabel({
          brand: "Shibui",
          expression: "Grain Select",
          distillery: [],
          category: "single_grain",
          stated_age: null,
          abv: null,
          cask_type: null,
        }),
      }),
    ).not.toContain("candidate category conflicts with extracted label");
  });

  test("allows a lower confidence threshold when the classifier reaffirms the current assignment", () => {
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 80,
        currentBottleId: 3,
        currentReleaseId: null,
        matchedBottleId: 3,
        matchedReleaseId: null,
      }),
    ).toBe(true);
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 79,
        currentBottleId: 3,
        currentReleaseId: null,
        matchedBottleId: 3,
        matchedReleaseId: null,
      }),
    ).toBe(false);
  });

  test("requires a higher confidence threshold for unmatched bottle-only matches", () => {
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 96,
        currentBottleId: null,
        currentReleaseId: null,
        matchedBottleId: 4,
        matchedReleaseId: null,
      }),
    ).toBe(true);
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 95,
        currentBottleId: null,
        currentReleaseId: null,
        matchedBottleId: 4,
        matchedReleaseId: null,
      }),
    ).toBe(false);
  });

  test("does not allow corrections from confidence alone", () => {
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 100,
        currentBottleId: 4,
        currentReleaseId: null,
        matchedBottleId: 5,
        matchedReleaseId: null,
      }),
    ).toBe(false);
  });

  test("does not allow unmatched release-level matches from confidence alone", () => {
    expect(
      isExistingMatchConfidenceEligibleForVerification({
        confidence: 100,
        currentBottleId: null,
        currentReleaseId: null,
        matchedBottleId: 5,
        matchedReleaseId: 12,
      }),
    ).toBe(false);
  });
});
