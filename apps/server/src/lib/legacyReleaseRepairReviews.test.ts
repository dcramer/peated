import { db } from "@peated/server/db";
import { bottles, legacyReleaseRepairReviews } from "@peated/server/db/schema";
import { refreshLegacyReleaseRepairReview } from "@peated/server/lib/legacyReleaseRepairReviews";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

function createClassifierCreateBottleResult() {
  return {
    status: "classified" as const,
    decision: {
      action: "create_bottle" as const,
      confidence: 92,
      rationale: "Local candidates do not show a reusable parent bottle.",
      candidateBottleIds: [],
      identityScope: "product" as const,
      observation: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: {
        name: "Classifier Parent",
        series: null,
        category: null,
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Classifier Brand",
        },
        distillers: [],
        bottler: null,
      },
      proposedRelease: null,
    },
    artifacts: {
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  };
}

describe("refreshLegacyReleaseRepairReview", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      createClassifierCreateBottleResult(),
    );
  });

  test("persists a reusable parent review for heuristic create-parent repairs", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Review Distillery" });
    const reusableParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Session Archive",
      totalTastings: 30,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });

    classifyBottleReferenceMock.mockResolvedValue({
      ...createClassifierCreateBottleResult(),
      decision: {
        ...createClassifierCreateBottleResult().decision,
        action: "match",
        matchedBottleId: reusableParent.id,
      },
    });

    const review = await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    expect(review).toMatchObject({
      legacyBottleId: legacyBottle.id,
      proposedParentFullName: "Review Distillery Warehouse Session",
      resolution: "reuse_existing_parent",
      reviewedParentBottleId: reusableParent.id,
      blockedReason: null,
    });
  });

  test("persists a blocked review when classifier cannot verify the parent decision", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Blocked Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });

    classifyBottleReferenceMock.mockResolvedValue({
      status: "ignored" as const,
      reason: "reference is too ambiguous",
    });

    const review = await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    expect(review).toMatchObject({
      legacyBottleId: legacyBottle.id,
      resolution: "blocked",
      reviewedParentBottleId: null,
      blockedReason:
        "Classifier could not review parent resolution: reference is too ambiguous",
    });
  });

  test("deletes a stored review when the bottle no longer needs create-parent review", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Delete Review Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 1)",
      totalTastings: 6,
    });

    await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    const exactParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session",
      totalTastings: 10,
    });

    const review = await refreshLegacyReleaseRepairReview({
      legacyBottleId: legacyBottle.id,
    });

    expect(review).toBeNull();

    const storedReview = await db.query.legacyReleaseRepairReviews.findFirst({
      where: (table, { eq }) => eq(table.legacyBottleId, legacyBottle.id),
    });
    expect(storedReview).toBeUndefined();

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, exactParent.id));
    expect(parentBottle?.fullName).toBe(exactParent.fullName);
  });
});
