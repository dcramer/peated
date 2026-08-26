import { describe, expect, test } from "vitest";

import { toStorePriceMatchDecision } from "./priceMatchingProposals";

describe("toStorePriceMatchDecision", () => {
  test("preserves alias scope metadata", () => {
    const decision = toStorePriceMatchDecision({
      price: {
        bottleId: null,
      },
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

test("does not change create_bottle into a correction", () => {
  const decision = toStorePriceMatchDecision({
    price: { bottleId: 1 },
    decision: {
      action: "create_bottle",
      rationale: "The observed Bottle is not in the catalog.",
      candidateBottleIds: [1],
      identityScope: "product",
      aliasScope: "none",
      observation: null,
      matchedBottleId: null,
      proposedBottle: {
        name: "Warehouse Selection",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: 10,
        abv: 46,
        caskStrength: null,
        singleCask: null,
        maturation: null,
        caskNumber: null,
        outturn: null,
        vintageYear: null,
        releaseYear: null,
        brand: { id: null, name: "Example Distillery" },
        distillers: [],
        bottler: null,
      },
    },
  });

  expect(decision.action).toBe("create_new");
  expect(decision.suggestedBottleId).toBeNull();
});
