import { db } from "@peated/server/db";
import {
  bottleAliases,
  incomingBottleDecisionLogs,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { bottleReleases } from "@peated/server/lib/test/legacyCatalogSchema";
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
      name: "Springbank Bottle Name",
      issue: "Default",
      url: "https://example.com/review",
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
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

    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, updatedReview!.bottleId as number),
    });
    expect(bottle?.fullName).toEqual("Springbank Bottle Name");

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(review.name)),
    });
    expect(alias).toMatchObject({
      bottleId: updatedReview?.bottleId,
      assignmentSource: "classifier_approved",
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
      createdBottle: true,
      createdRelease: false,
      confidence: null,
      model: expect.any(String),
      rationale: "test fixture",
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
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
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
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
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: bottle.id,
      createdBottle: false,
      createdRelease: false,
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
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
  });

  test("assigns a classifier match to its direct active Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Worker Direct Bottle",
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      name: "Worker Direct Bottle Review",
      issue: "Default",
      url: "https://example.com/worker-direct-bottle-review",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
        },
        { candidates: [{ bottleId: bottle.id }] },
      ),
    );

    await createMissingBottles();

    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: bottle.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(review.name)),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
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
      bottleId: bottle.id,
    });
  });

  test("attempts unresolved Reviews", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({ admin: true });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
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
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
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
        })
        .where(eq(reviews.id, review.id));
      return buildClassification(
        {
          action: "match",
          matchedBottleId: suggestedBottle.id,
          candidateBottleIds: [suggestedBottle.id],
        },
        { candidates: [{ bottleId: suggestedBottle.id }] },
      );
    });

    await createMissingBottles();

    const preserved = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(preserved).toMatchObject({
      bottleId: concurrentBottle.id,
    });
  });
});
