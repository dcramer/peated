import { describe, expect, test } from "vitest";

import { toStorePriceMatchDecision } from "./priceMatchingProposals";

describe("toStorePriceMatchDecision", () => {
  test("preserves alias scope metadata", () => {
    const decision = toStorePriceMatchDecision({
      price: {
        bottleId: null,
      },
      candidates: [],
      decision: {
        action: "match",
        rationale: "Exact source page identifies a generic listing title.",
        candidateBottleIds: [123],
        identityScope: "product",
        aliasScope: "none",
        observation: null,
        matchedBottleId: 123,
        proposedBottle: null,
      },
    });

    expect(decision).toMatchObject({
      action: "match_existing",
      suggestedBottleId: 123,
      aliasScope: "none",
    });
  });
});

const candidate = {
  bottleId: 1,
  alias: "Example Distillery Warehouse Selection",
  fullName: "Example Distillery Warehouse Selection",
  brand: "Example Distillery",
  bottler: null,
  series: null,
  distillery: ["Example Distillery"],
  category: "single_malt" as const,
  statedAge: 10,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: 46,
  vintageYear: null,
  releaseYear: null,
  caskType: "bourbon" as const,
  caskSize: "barrel" as const,
  caskFill: "1st_fill" as const,
  score: 1,
  source: ["current"],
};

function buildRepairDecision(statedAge: number) {
  return {
    action: "repair_bottle" as const,
    confidence: 90,
    rationale: "Review the extracted metadata.",
    candidateBottleIds: [candidate.bottleId],
    identityScope: "product" as const,
    aliasScope: "none" as const,
    observation: null,
    identityBasis: null,
    confidenceBasis: null,
    matchedBottleId: candidate.bottleId,
    proposedBottle: {
      name: "Warehouse Selection",
      series: null,
      category: "single_malt" as const,
      edition: null,
      statedAge,
      caskStrength: null,
      singleCask: null,
      abv: 46,
      vintageYear: null,
      releaseYear: null,
      caskType: "oloroso" as const,
      caskSize: "butt" as const,
      caskFill: "2nd_fill" as const,
      brand: { id: null, name: "Example Distillery" },
      distillers: [{ id: null, name: "Example Distillery" }],
      bottler: null,
    },
  };
}

test("does not turn normalized cask differences into a bottle repair", () => {
  const decision = toStorePriceMatchDecision({
    price: { bottleId: candidate.bottleId },
    decision: buildRepairDecision(candidate.statedAge),
    candidates: [candidate],
  });

  expect(decision.action).toBe("match_existing");
  expect(decision.proposedBottle).toBeNull();
});

test("strips normalized cask fields from a repair with material changes", () => {
  const decision = toStorePriceMatchDecision({
    price: { bottleId: candidate.bottleId },
    decision: buildRepairDecision(12),
    candidates: [candidate],
  });

  expect(decision.action).toBe("correction");
  expect(decision.proposedBottle).toMatchObject({
    statedAge: 12,
    caskType: null,
    caskSize: null,
    caskFill: null,
  });
});
