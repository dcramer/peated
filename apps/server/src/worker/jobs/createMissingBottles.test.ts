import { BottleClassificationResultSchema } from "@peated/bottle-classifier";
import type { BottleClassificationDecision } from "@peated/server/agents/bottleClassifier";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalReviews,
  incomingBottleDecisionLogs,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import {
  createMissingBottles as createMissingBottlesWithServices,
  type CreateMissingBottlesServices,
} from "@peated/server/worker/jobs/createMissingBottles";
import type { JobPayload } from "@peated/server/worker/types";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock =
  vi.fn<CreateMissingBottlesServices["classifyReference"]>();

type MockClassificationDecision = Pick<
  BottleClassificationDecision,
  "action"
> & {
  candidateBottleIds?: number[];
  matchedBottleId?: number;
  proposedBottle?: Extract<
    BottleClassificationDecision,
    { action: "create_bottle" }
  >["proposedBottle"];
};

type MockClassificationArtifacts = {
  candidates?: Array<{ bottleId: number }>;
};

function createMissingBottles(rawInput?: JobPayload) {
  return createMissingBottlesWithServices(rawInput, {
    classifyReference: classifyBottleReferenceMock,
  });
}

function buildClassification(
  decision: MockClassificationDecision,
  artifacts: MockClassificationArtifacts = {},
) {
  return BottleClassificationResultSchema.parse({
    status: "classified" as const,
    decision: {
      rationale: "test fixture",
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      ...decision,
    },
    artifacts: {
      extractedIdentity: null,
      candidates:
        artifacts.candidates?.map((candidate) => ({
          fullName: `Candidate ${candidate.bottleId}`,
          ...candidate,
        })) ?? [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  });
}

describe("createMissingBottles", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    vi.mocked(workerClient.pushUniqueJob).mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
  });

  test("uses the classifier to create bottles for unmatched reviews", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const issue = "Default";
    const url = "https://example.com/review";
    const systemActor = await getPeatedSystemActor();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Springbank Bottle Name",
      issue,
      url,
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
          maturation: null,
          caskNumber: null,
          outturn: null,
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

    const updatedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(updatedReview?.bottleId).toBeTruthy();
    if (!updatedReview?.bottleId) throw new Error("Review has no Bottle");
    const bottleId = updatedReview.bottleId;

    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, bottleId),
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
      externalSiteId: site.id,
      url,
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
          identityScope: "product",
          observation: null,
          confidenceBasis: null,
        },
        resolutionSource: "classifier_create_bottle",
        issue,
      }),
    });

    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      {
        bottleId: updatedReview?.bottleId,
      },
    );
  });

  test("audits safe canonical create reuse as an existing Bottle match", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({ name: "Worker Existing Brand" });
    const issue = "Canonical reuse";
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: `${bottle.fullName} critic review`,
      issue,
      url: "https://example.com/worker-safe-canonical-reuse",
    });
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
          maturation: null,
          caskNumber: null,
          outturn: null,
          brand: { id: null, name: brand.name },
          distillers: [],
          bottler: null,
        },
      }),
    );

    await createMissingBottles();

    const updatedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
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
          identityScope: "product",
          observation: null,
          confidenceBasis: null,
        },
        resolutionSource: "classifier_create_bottle",
        issue,
      }),
    });
  });

  test("only visits unresolved reviews once per run", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Unknown Review Title",
      issue: "Default",
      url: "https://example.com/unresolved-review",
    });

    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);

    const unchangedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toBeNull();
  });

  test("limits queued work to one review article", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const selected = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Selected Article Review",
      category: "single_malt",
      url: "https://example.com/selected-review",
    });
    const skipped = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Other Article Review",
      url: "https://example.com/other-review",
    });

    await createMissingBottles({ articleId: selected.articleId });

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    expect(classifyBottleReferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedIdentity: expect.objectContaining({
          category: "single_malt",
        }),
        reference: expect.objectContaining({ id: selected.id }),
      }),
    );
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, skipped.id),
      }),
    ).toMatchObject({ bottleId: null });
  });

  test("assigns a classifier match to its direct active Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Worker Direct Bottle",
    });
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Worker Direct Bottle Review",
      issue: "Default",
      url: "https://example.com/worker-direct-bottle-review",
    });
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
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
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

  test("publishes a newly resolved review in automatic mode", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
    const bottle = await fixtures.Bottle({ name: "Published Worker Bottle" });
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      hidden: true,
      name: "Published Worker Bottle Review",
      url: "https://example.com/published-worker-review",
    });
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

    await createMissingBottles({ articleId: review.articleId });

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, hidden: false });
  });

  test("attempts unresolved Reviews", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Generic Review Group",
      issue: "Default",
      url: "https://example.com/generic-review",
    });

    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: null,
    });
  });

  test("preserves a Review retargeted while classification runs", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const suggestedBottle = await fixtures.Bottle({
      name: "Suggested Worker Bottle",
    });
    const concurrentBottle = await fixtures.Bottle({
      name: "Concurrent Worker Bottle",
    });
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Concurrent Worker Review",
      issue: "Default",
      url: "https://example.com/concurrent-worker-review",
    });
    classifyBottleReferenceMock.mockImplementationOnce(async () => {
      await db
        .update(externalReviews)
        .set({
          bottleId: concurrentBottle.id,
        })
        .where(eq(externalReviews.id, review.id));
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

    const preserved = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(preserved).toMatchObject({
      bottleId: concurrentBottle.id,
    });
  });
});
