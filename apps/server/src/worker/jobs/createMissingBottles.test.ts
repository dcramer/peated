import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  catalogTargets,
  incomingBottleDecisionLogs,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import createMissingBottles from "@peated/server/worker/jobs/createMissingBottles";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const pushJobMock = vi.hoisted(() => vi.fn());
const pushUniqueJobMock = vi.hoisted(() => vi.fn());
const getAutomationModeratorUserMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

vi.mock("@peated/server/worker/client", () => ({
  pushJob: pushJobMock,
  pushUniqueJob: pushUniqueJobMock,
}));

vi.mock("@peated/server/lib/systemUser", () => ({
  getAutomationModeratorUser: getAutomationModeratorUserMock,
}));

function buildClassification(
  decision: Record<string, unknown>,
  artifacts: Record<string, unknown> = {},
) {
  return {
    status: "classified" as const,
    decision: {
      confidence: 0.9,
      rationale: "test fixture",
      candidateBottleIds: [],
      ...decision,
    },
    artifacts: {
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
      ...artifacts,
    },
  };
}

describe("createMissingBottles", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    pushJobMock.mockReset();
    pushUniqueJobMock.mockReset();
    getAutomationModeratorUserMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
  });

  test("uses the classifier to create bottles for unmatched reviews", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({
      admin: true,
      username: "dcramer",
    });
    const systemActor = await getPeatedSystemActor();
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: "Springbank Bottle Name",
      issue: "Default",
      url: "https://example.com/review",
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: review.name,
    });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle",
        proposedBottle: {
          name: "Bottle Name",
          series: null,
          category: "single_malt",
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
            name: "Springbank",
          },
          distillers: [],
          bottler: null,
        },
      }),
    );

    await createMissingBottles();

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(updatedReview?.bottleId).toBeTruthy();
    expect(updatedReview?.releaseId).toBeNull();

    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, updatedReview!.bottleId as number),
    });
    expect(bottle?.fullName).toEqual("Springbank Bottle Name");
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle!.id),
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(review.name)),
    });
    expect(alias).toMatchObject({
      bottleId: updatedReview?.bottleId,
      targetId: target!.id,
      assignmentSource: "canonical",
      assignedByActorId: systemActor.id,
    });

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    expect(updatedPrice?.bottleId).toEqual(updatedReview?.bottleId);

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "review",
      sourceId: review.id,
      decision: "create_bottle",
      actorId: systemActor.id,
      bottleId: updatedReview?.bottleId,
      releaseId: null,
      targetId: target!.id,
      createdBottle: true,
      createdRelease: false,
      confidence: null,
      model: expect.any(String),
      rationale: "test fixture",
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
          parentBottleId: null,
          identityScope: null,
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
        },
        resolutionSource: "classifier_create_bottle",
        issue: review.issue,
      }),
    });

    expect(pushUniqueJobMock).toHaveBeenCalledWith("IndexBottleSearchVectors", {
      bottleId: updatedReview?.bottleId,
    });
  });

  test("audits release-shaped creation as a concrete Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const systemActor = await getPeatedSystemActor();
    const parent = await fixtures.Bottle({
      name: "Worker Release Family",
      statedAge: 12,
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: `${parent.fullName} Batch 24`,
      issue: "Batch review",
      url: "https://example.com/worker-release-shaped-create",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "create_release",
          parentBottleId: parent.id,
          identityScope: "product",
          observation: {
            selector: "Batch 24 label",
            caskNumber: null,
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          identityBasis: {
            bottleTraits: ["brand", "expression"],
            releaseTraits: ["edition"],
            observationTraits: ["label selector"],
            yearInterpretation: "none",
            siblingEvidence: "single_known_release",
            uncertainties: [],
          },
          confidenceBasis: {
            positiveEvidence: ["classifier-selected parent"],
            unresolvedRisks: [],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_used",
          },
          proposedRelease: {
            edition: "Batch 24",
            statedAge: null,
            abv: 54.1,
            caskStrength: true,
            singleCask: false,
            vintageYear: null,
            releaseYear: 2024,
            caskType: null,
            caskSize: null,
            caskFill: null,
            description: null,
            tastingNotes: null,
            imageUrl: null,
          },
        },
        {
          candidates: [{ bottleId: parent.id, releaseId: null }],
        },
      ),
    );

    await createMissingBottles();

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, updatedReview!.bottleId!),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, createdBottle!.id),
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review.id),
      ),
    });

    expect(createdBottle).toMatchObject({
      groupId: parent.groupId,
      edition: "Batch 24",
    });
    expect(createdBottle!.id).not.toBe(parent.id);
    expect(decisionLog).toMatchObject({
      decision: "create_bottle",
      bottleId: createdBottle!.id,
      releaseId: null,
      targetId: target!.id,
      createdBottle: true,
      createdRelease: false,
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_release",
          parentBottleId: parent.id,
          identityScope: "product",
          observation: {
            selector: "Batch 24 label",
            caskNumber: null,
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          identityBasis: {
            bottleTraits: ["brand", "expression"],
            releaseTraits: ["edition"],
            observationTraits: ["label selector"],
            yearInterpretation: "none",
            siblingEvidence: "single_known_release",
            uncertainties: [],
          },
          confidenceBasis: {
            positiveEvidence: ["classifier-selected parent"],
            unresolvedRisks: [],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_used",
          },
        },
        resolutionSource: "classifier_create_release",
        issue: review.issue,
      }),
    });
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("audits safe canonical create reuse as an existing Bottle match", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Worker Existing Brand" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Worker Existing Bottle",
    });
    await db
      .update(bottleAliases)
      .set({ assignmentSource: "canonical" })
      .where(
        and(
          eq(bottleAliases.bottleId, bottle.id),
          eq(bottleAliases.name, bottle.fullName),
        ),
      );
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: `${bottle.fullName} critic review`,
      issue: "Canonical reuse",
      url: "https://example.com/worker-safe-canonical-reuse",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle",
        proposedBottle: {
          name: bottle.name,
          series: null,
          category: bottle.category,
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
          brand: { id: null, name: brand.name },
          distillers: [],
          bottler: null,
        },
      }),
    );

    await createMissingBottles();

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review.id),
      ),
    });

    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: bottle.id,
      releaseId: null,
      targetId: target!.id,
      createdBottle: false,
      createdRelease: false,
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
          parentBottleId: null,
          identityScope: null,
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
        },
        resolutionSource: "classifier_create_bottle",
        issue: review.issue,
      }),
    });
    expect(await db.select().from(bottleReleases)).toEqual([]);
  });

  test("only visits unresolved reviews once per run", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({
      admin: true,
      username: "dcramer",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: "Unknown Review Title",
      issue: "Default",
      url: "https://example.com/unresolved-review",
    });

    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);

    const unchangedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toBeNull();
    expect(unchangedReview?.releaseId).toBeNull();
  });
});
