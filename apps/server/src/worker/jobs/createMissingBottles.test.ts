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
import { and, eq, isNull } from "drizzle-orm";
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
    expect(updatedReview?.targetId).toBeNull();

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(review.name)),
    });
    expect(alias).toMatchObject({
      bottleId: updatedReview?.bottleId,
      targetId: null,
      assignmentSource: "classifier_approved",
      assignedByActorId: systemActor.id,
    });

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    expect(updatedPrice?.bottleId).toEqual(updatedReview?.bottleId);
    expect(updatedPrice?.targetId).toBeNull();

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
      targetId: null,
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
      targetId: null,
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

  test("assigns a classifier match to its direct active Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const parent = await fixtures.Bottle({
      name: "Worker Unpromoted Parent",
    });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: "Worker Unpromoted Release Review",
      issue: "Default",
      url: "https://example.com/worker-unpromoted-review",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: parent.id,
          matchedReleaseId: release.id,
          candidateBottleIds: [parent.id],
        },
        { candidates: [{ bottleId: parent.id, releaseId: release.id }] },
      ),
    );

    await createMissingBottles();

    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(review.name)),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      assignmentSource: "classifier_approved",
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, review.id),
        ),
      }),
    ).toMatchObject({
      decision: "match_existing",
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
    });
  });

  test("attempts unresolved Reviews even when legacy target evidence remains", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const member = await fixtures.Bottle({ name: "Generic Review Group" });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, member.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      targetId: genericTarget!.id,
      bottleId: null,
      releaseId: null,
      name: "Generic Review Group",
      issue: "Default",
      url: "https://example.com/generic-review",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);

    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: genericTarget!.id,
    });
  });

  test("preserves a Review retargeted while classification runs", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const suggestedBottle = await fixtures.Bottle({
      name: "Suggested Worker Bottle",
    });
    const concurrentBottle = await fixtures.Bottle({
      name: "Concurrent Worker Bottle",
    });
    const concurrentTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, concurrentBottle.id),
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: "Concurrent Worker Review",
      issue: "Default",
      url: "https://example.com/concurrent-worker-review",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    classifyBottleReferenceMock.mockImplementationOnce(async () => {
      await db
        .update(reviews)
        .set({
          bottleId: concurrentBottle.id,
          releaseId: null,
          targetId: concurrentTarget!.id,
        })
        .where(eq(reviews.id, review.id));
      return buildClassification(
        {
          action: "match",
          matchedBottleId: suggestedBottle.id,
          matchedReleaseId: null,
          candidateBottleIds: [suggestedBottle.id],
        },
        { candidates: [{ bottleId: suggestedBottle.id, releaseId: null }] },
      );
    });

    await createMissingBottles();

    const preserved = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(preserved).toMatchObject({
      bottleId: concurrentBottle.id,
      releaseId: null,
      targetId: concurrentTarget!.id,
    });
  });
});
