import { describe, expect, it } from "vitest";

import {
  canApproveSuggestedBottle,
  getBottleRepairChanges,
  isRepairProposal,
} from "./queueItemCard";

type DecisionItem = Parameters<typeof canApproveSuggestedBottle>[0];
type DecisionBottle = NonNullable<DecisionItem["suggestedBottle"]>;

function bottle(id: number): DecisionBottle {
  return { id };
}

function decisionItem(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    status: "pending_review",
    isProcessing: false,
    proposalType: "match_existing",
    currentBottle: null,
    suggestedBottle: bottle(10),
    proposedBottle: null,
    proposedRelease: null,
    ...overrides,
  };
}

describe("queue item Bottle actions", () => {
  it("allows a direct suggested Bottle to be approved", () => {
    expect(canApproveSuggestedBottle(decisionItem())).toBe(true);
  });

  it("does not offer approval without a suggested Bottle", () => {
    expect(
      canApproveSuggestedBottle(decisionItem({ suggestedBottle: null })),
    ).toBe(false);
  });

  it("recognizes repairs only when both assignments are the same Bottle", () => {
    const proposedBottle = {} as NonNullable<DecisionItem["proposedBottle"]>;

    const repair = decisionItem({
      proposalType: "correction",
      currentBottle: bottle(10),
      suggestedBottle: bottle(10),
      proposedBottle,
    });
    expect(isRepairProposal(repair)).toBe(true);
    expect(canApproveSuggestedBottle(repair)).toBe(false);

    expect(
      isRepairProposal({
        ...repair,
        suggestedBottle: bottle(11),
      }),
    ).toBe(false);
    expect(
      isRepairProposal({
        ...repair,
        currentBottle: null,
        suggestedBottle: null,
      }),
    ).toBe(false);
    expect(
      isRepairProposal({
        ...repair,
        proposedRelease: {} as NonNullable<DecisionItem["proposedRelease"]>,
      }),
    ).toBe(false);
  });

  it("keeps relational repair comparisons ID-aware without exposing IDs", () => {
    type CurrentBottle = Parameters<typeof getBottleRepairChanges>[0];
    type ProposedBottle = Parameters<typeof getBottleRepairChanges>[1];
    const currentBottle = {
      brand: { id: 1 },
      name: "12 Cask Strength",
      series: { id: 2 },
      category: null,
      distillers: [{ id: 3 }],
      bottler: { id: 4 },
      statedAge: null,
      edition: null,
      abv: null,
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      vintageYear: null,
      releaseYear: null,
    } as CurrentBottle;
    const proposedBottle = {
      brand: { id: 5, name: "Springbank" },
      name: currentBottle.name,
      series: { id: 6, name: "Core Range" },
      category: null,
      distillers: [{ id: 7, name: "Springbank Distillery" }],
      bottler: { id: 8, name: "Official Bottling" },
      statedAge: null,
      edition: null,
      abv: null,
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      vintageYear: null,
      releaseYear: null,
    } as ProposedBottle;

    const changes = getBottleRepairChanges(currentBottle, proposedBottle);

    expect(changes.map(({ label }) => label)).toEqual([
      "Brand",
      "Series",
      "Distillery",
      "Bottler",
    ]);
    expect(
      changes.every(({ current }) => current === "Existing Bottle value"),
    ).toBe(true);
    expect(JSON.stringify(changes)).not.toContain("#");

    expect(
      getBottleRepairChanges(currentBottle, {
        ...proposedBottle,
        brand: { ...proposedBottle.brand, id: 1 },
        series: { ...proposedBottle.series!, id: 2 },
        distillers: [{ ...proposedBottle.distillers[0]!, id: 3 }],
        bottler: { ...proposedBottle.bottler!, id: 4 },
      }),
    ).toEqual([]);
  });
});
