import { describe, expect, test } from "vitest";
import { toStorePriceMatchDecision } from "./priceMatchingProposals";

describe("toStorePriceMatchDecision", () => {
  test("preserves alias scope metadata", () => {
    const decision = toStorePriceMatchDecision({
      price: {
        bottleId: null,
        releaseId: null,
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
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
    });

    expect(decision).toMatchObject({
      action: "match_existing",
      suggestedBottleId: 123,
      aliasScope: "none",
    });
  });
});
