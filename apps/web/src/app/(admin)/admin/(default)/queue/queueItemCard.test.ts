import type { CatalogTargetV1 } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";

import {
  canApproveSuggestedTarget,
  getBottleRepairChanges,
  isRepairProposal,
} from "./queueItemCard";

type DecisionItem = Parameters<typeof canApproveSuggestedTarget>[0];

function exactTarget(bottleId: number, targetId = bottleId) {
  return {
    kind: "bottle",
    targetId,
    bottle: { id: bottleId, fullName: `Bottle ${bottleId}` },
    group: { id: 1, fullName: "Bottle Group" },
  } as CatalogTargetV1;
}

function genericTarget(targetId: number) {
  return {
    kind: "group",
    targetId,
    group: { id: 1, fullName: "Bottle Group" },
  } as CatalogTargetV1;
}

function decisionItem(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    status: "pending_review",
    isProcessing: false,
    proposalType: "match_existing",
    currentTarget: null,
    suggestedTarget: exactTarget(10),
    proposedBottle: null,
    proposedRelease: null,
    ...overrides,
  };
}

describe("queue item target actions", () => {
  it("allows exact and generic suggested targets to be approved", () => {
    expect(canApproveSuggestedTarget(decisionItem())).toBe(true);
    expect(
      canApproveSuggestedTarget(
        decisionItem({ suggestedTarget: genericTarget(20) }),
      ),
    ).toBe(true);
  });

  it("does not offer approval without a suggested target", () => {
    expect(
      canApproveSuggestedTarget(decisionItem({ suggestedTarget: null })),
    ).toBe(false);
  });

  it("recognizes repairs only for exact targets on the same Bottle", () => {
    const proposedBottle = {} as NonNullable<DecisionItem["proposedBottle"]>;

    const repair = decisionItem({
      proposalType: "correction",
      currentTarget: exactTarget(10, 100),
      suggestedTarget: exactTarget(10, 101),
      proposedBottle,
    });
    expect(isRepairProposal(repair)).toBe(true);
    expect(canApproveSuggestedTarget(repair)).toBe(false);

    expect(
      isRepairProposal({
        ...repair,
        suggestedTarget: exactTarget(11, 102),
      }),
    ).toBe(false);
    expect(
      isRepairProposal({
        ...repair,
        currentTarget: genericTarget(103),
        suggestedTarget: genericTarget(104),
      }),
    ).toBe(false);
  });

  it("keeps relational repair comparisons ID-aware without exposing IDs", () => {
    type CurrentBottle = Parameters<typeof getBottleRepairChanges>[0];
    type ProposedBottle = Parameters<typeof getBottleRepairChanges>[1];
    const currentBottle = {
      brandId: 1,
      name: "12 Cask Strength",
      seriesId: 2,
      category: null,
      distillerIds: [3],
      bottlerId: 4,
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
      changes.every(({ current }) => current === "Existing catalog value"),
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
