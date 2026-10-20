import { BottleClassificationResultSchema } from "@peated/bottle-classifier";
import type { BottleClassificationDecision } from "@peated/server/agents/bottleClassifier";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleReferences,
  bottles,
  externalReviews,
  incomingBottleDecisionLogs,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { listActionableBottleChecks } from "@peated/server/lib/bottleChecks";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import {
  createMissingBottles as createMissingBottlesWithServices,
  type CreateMissingBottlesServices,
} from "@peated/server/worker/jobs/createMissingBottles";
import type { JobPayload } from "@peated/server/worker/types";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock =
  vi.fn<CreateMissingBottlesServices["classifyReference"]>();

type MockClassificationDecision = Pick<
  BottleClassificationDecision,
  "action"
> & {
  candidateBottleIds?: number[];
  matchedBottleId?: number;
  referenceScope?: "global_alias" | "none";
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

async function findReviewBottleCheck(reviewId: number) {
  return await db.query.bottleChecks.findFirst({
    where: and(
      eq(bottleChecks.sourceKind, "review"),
      eq(bottleChecks.sourceId, String(reviewId)),
    ),
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
      confidenceBasis: { webEvidence: "supportive", unresolvedRisks: [] },
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      referenceScope: "global_alias",
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
  test.for(["match", "create_bottle"] as const)(
    "sends a %s with unresolved risks to moderation before any assignment or creation",
    async (action, { fixtures }) => {
      const brand = await fixtures.Entity({ name: "Evidence Bottler" });
      const candidate = await fixtures.Bottle({ brandId: brand.id });
      const review = await fixtures.ExternalReview({
        bottleId: null,
        name: "Uncertain review",
      });
      const classification = BottleClassificationResultSchema.parse({
        status: "classified",
        decision: {
          action,
          matchedBottleId: action === "match" ? candidate.id : null,
          candidateBottleIds: [candidate.id],
          proposedBottle:
            action === "create_bottle"
              ? {
                  name: "New release",
                  brand: { id: brand.id, name: brand.name },
                  distillers: [],
                  category: "single_malt",
                }
              : null,
          rationale: "The label identity is still uncertain.",
          identityScope: "product",
          observation: null,
          referenceScope: "none",
          confidenceBasis: {
            webEvidence: "supportive",
            unresolvedRisks: [
              {
                category: "identity_ambiguity",
                note: "The product label is unclear.",
              },
            ],
          },
        },
        artifacts: {
          candidates: [
            { bottleId: candidate.id, fullName: candidate.fullName },
          ],
          extractedIdentity: null,
          searchEvidence: [],
          resolvedEntities: [],
        },
      });
      classifyBottleReferenceMock.mockResolvedValueOnce(classification);
      await createMissingBottles({ reviewId: review.id });
      expect(
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, review.id),
        }),
      ).toMatchObject({ bottleId: null, bottleNoMatchAt: expect.any(Date) });
      const mod = await fixtures.User({ mod: true });
      expect(
        (
          await routerClient.admin.moderation.listTasks(undefined, {
            context: { user: mod },
          })
        ).results,
      ).toEqual([
        expect.objectContaining({ key: `external_review:${review.id}` }),
      ]);
      expect(await db.select().from(bottles)).toHaveLength(1);
      expect(await findReviewBottleCheck(review.id)).toBeDefined();
    },
  );
  test("assigns only the review when source context cannot support a global alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Dated release 2020" });
    const review = await fixtures.ExternalReview({
      bottleId: null,
      name: "Generic title",
      issue: "Fall 2020",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: review.name,
    });
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          referenceScope: "none",
        },
        { candidates: [{ bottleId: bottle.id }] },
      ),
    );
    await createMissingBottles({ articleId: review.articleId });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, matchedReferenceId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(
          bottleReferences.name,
          normalizeBottleReferenceKey(review.name),
        ),
      }),
    ).toBeUndefined();
  });
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

    const alias = await db.query.bottleReferences.findFirst({
      where: eq(
        bottleReferences.name,
        normalizeBottleReferenceKey(review.name),
      ),
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
          confidenceBasis: { webEvidence: "supportive", unresolvedRisks: [] },
        },
        resolutionSource: "classifier_create_bottle",
        issue,
      }),
    });

    // The saved run lets a wrong decision become an eval test case later.
    const check = await findReviewBottleCheck(review.id);
    expect(check).toMatchObject({
      intent: "resolve_reference",
      sourceKind: "review",
      sourceId: String(review.id),
      model: expect.any(String),
      inputSnapshot: {
        reference: expect.objectContaining({ name: review.name, url }),
      },
      output: expect.objectContaining({
        status: "classified",
        decision: expect.objectContaining({ action: "create_bottle" }),
      }),
      artifacts: expect.objectContaining({ candidates: [] }),
    });
    const actionable = await listActionableBottleChecks({ limit: 100 });
    expect(actionable.results.map((item) => item.id)).not.toContain(check?.id);

    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearch",
      {
        bottleId: updatedReview?.bottleId,
      },
    );
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId },
      {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: false,
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
      .update(bottleReferences)
      .set({ assignmentSource: "canonical" })
      .where(
        and(
          eq(bottleReferences.bottleId, bottle.id),
          eq(bottleReferences.name, bottle.fullName),
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
      decision: "match",
      bottleId: bottle.id,
      createdBottle: false,
      createdRelease: false,
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
          identityScope: "product",
          observation: null,
          confidenceBasis: { webEvidence: "supportive", unresolvedRisks: [] },
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

  test("records a no-match answer and does not ask again", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Unknown Review Title",
      url: "https://example.com/no-match-review",
    });

    await createMissingBottles();
    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    const marked = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(marked?.bottleId).toBeNull();
    expect(marked?.bottleNoMatchAt).toBeInstanceOf(Date);
    expect(await findReviewBottleCheck(review.id)).toMatchObject({
      output: expect.objectContaining({
        decision: expect.objectContaining({ action: "no_match" }),
      }),
    });
  });

  test("asks again after a classifier failure", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: "Unknown Review Title",
      url: "https://example.com/failed-review",
    });
    classifyBottleReferenceMock.mockRejectedValueOnce(
      new Error("The AI service is unavailable."),
    );

    await expect(createMissingBottles()).rejects.toThrow(
      "The AI service is unavailable.",
    );
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleNoMatchAt: null });

    await createMissingBottles();
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(2);
  });

  test("rechecks legacy attempt timestamps with PostgreSQL microsecond precision", async ({
    fixtures,
  }) => {
    const review = await fixtures.ExternalReview({ bottleId: null });
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: sql`'2026-10-16 18:45:00.123456'::timestamp` })
      .where(eq(externalReviews.id, review.id));
    const mod = await fixtures.User({ mod: true });
    await routerClient.externalReviews.recheck(
      {
        reviews: [
          {
            reviewId: review.id,
            name: review.name,
            attemptedAt: "2026-10-16T18:45:00.123Z",
          },
        ],
      },
      { context: { user: mod } },
    );
    await createMissingBottles(
      workerClient.pushUniqueJob.mock.calls.at(-1)![1],
    );
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    const completed = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(completed?.bottleNoMatchAt?.getTime()).toBeGreaterThan(
      new Date("2026-10-16T18:45:00.123Z").getTime(),
    );
  });

  test("failed rechecks remain in moderation and can be requeued without another import", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const review = await fixtures.ExternalReview({ bottleId: null });
    const attemptedAt = new Date("2026-10-16T18:45:00.000Z");
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, review.id));
    const input = {
      reviews: [
        {
          reviewId: review.id,
          name: review.name,
          attemptedAt: attemptedAt.toISOString(),
        },
      ],
    };
    await routerClient.externalReviews.recheck(input, {
      context: { user: mod },
    });
    const payload = workerClient.pushUniqueJob.mock.calls.at(-1)![1];
    const assertVisible = async () => {
      await expect(
        routerClient.admin.moderation.task(
          { key: `external_review:${review.id}` },
          { context: { user: mod } },
        ),
      ).resolves.toMatchObject({
        task: { key: `external_review:${review.id}` },
      });
      expect(
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, review.id),
        }),
      ).toMatchObject({ bottleId: null, bottleNoMatchAt: attemptedAt });
    };
    await assertVisible();
    classifyBottleReferenceMock.mockRejectedValueOnce(
      new Error("Classifier unavailable"),
    );
    await expect(createMissingBottles(payload)).rejects.toThrow(
      "Classifier unavailable",
    );
    await assertVisible();
    expect(await findReviewBottleCheck(review.id)).toBeUndefined();
    await routerClient.externalReviews.recheck(input, {
      context: { user: mod },
    });
    await createMissingBottles(
      workerClient.pushUniqueJob.mock.calls.at(-1)![1],
    );
    const completed = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(completed?.bottleNoMatchAt?.getTime()).toBeGreaterThan(
      attemptedAt.getTime(),
    );
    expect(await findReviewBottleCheck(review.id)).toBeDefined();
    await createMissingBottles(payload);
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(2);
    await expect(
      routerClient.externalReviews.recheck(input, { context: { user: mod } }),
    ).rejects.toThrow("review changed");
  });

  test("a queued recheck can match a review and safely replay after success", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true, admin: true });
    const review = await fixtures.ExternalReview({ bottleId: null });
    const attemptedAt = new Date("2026-10-16T18:45:00.000Z");
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, review.id));
    const bottle = await fixtures.Bottle();
    classifyBottleReferenceMock.mockResolvedValueOnce(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          referenceScope: "none",
        },
        { candidates: [{ bottleId: bottle.id }] },
      ),
    );
    await routerClient.externalReviews.recheck(
      {
        reviews: [
          {
            reviewId: review.id,
            name: review.name,
            attemptedAt: attemptedAt.toISOString(),
          },
        ],
      },
      { context: { user: mod } },
    );
    const payload = workerClient.pushUniqueJob.mock.calls.at(-1)![1];
    await createMissingBottles(payload);
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, bottleNoMatchAt: null });
    await expect(
      routerClient.admin.moderation.task(
        { key: `external_review:${review.id}` },
        { context: { user: mod } },
      ),
    ).rejects.toThrow("no longer needs attention");
    await createMissingBottles(payload);
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test.for(["assigned", "removed", "renamed", "new_attempt"] as const)(
    "skips a queued recheck after the review is %s",
    async (change, { fixtures }) => {
      const review = await fixtures.ExternalReview({ bottleId: null });
      const attemptedAt = new Date("2026-10-16T18:45:00.000Z");
      await db
        .update(externalReviews)
        .set({ bottleNoMatchAt: attemptedAt })
        .where(eq(externalReviews.id, review.id));
      const mod = await fixtures.User({ mod: true, admin: true });
      await routerClient.externalReviews.recheck(
        {
          reviews: [
            {
              reviewId: review.id,
              name: review.name,
              attemptedAt: attemptedAt.toISOString(),
            },
          ],
        },
        { context: { user: mod } },
      );
      if (change === "removed") {
        await routerClient.admin.content.moderate(
          {
            kind: "external_review",
            id: review.id,
            removed: true,
            reason: "Not a review.",
          },
          { context: { user: mod } },
        );
      } else
        await db
          .update(externalReviews)
          .set(
            change === "assigned"
              ? {
                  bottleId: (await fixtures.Bottle()).id,
                  bottleNoMatchAt: null,
                }
              : change === "renamed"
                ? { name: "Changed review" }
                : { bottleNoMatchAt: new Date() },
          )
          .where(eq(externalReviews.id, review.id));
      const changed = await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      });
      await createMissingBottles(
        workerClient.pushUniqueJob.mock.calls.at(-1)![1],
      );
      expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
      expect(
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, review.id),
        }),
      ).toEqual(changed);
    },
  );

  test.for([
    ["assigned", "match"],
    ["removed", "match"],
    ["renamed", "match"],
    ["new_attempt", "match"],
    ["assigned", "no_match"],
    ["removed", "no_match"],
    ["renamed", "no_match"],
    ["new_attempt", "no_match"],
  ] as const)(
    "does not overwrite concurrent %s changes with a %s result",
    async ([change, action], { fixtures }) => {
      const review = await fixtures.ExternalReview({ bottleId: null });
      const attemptedAt = new Date("2026-10-16T18:45:00.000Z");
      await db
        .update(externalReviews)
        .set({ bottleNoMatchAt: attemptedAt })
        .where(eq(externalReviews.id, review.id));
      const bottle = await fixtures.Bottle();
      const mod = await fixtures.User({ mod: true, admin: true });
      await routerClient.externalReviews.recheck(
        {
          reviews: [
            {
              reviewId: review.id,
              name: review.name,
              attemptedAt: attemptedAt.toISOString(),
            },
          ],
        },
        { context: { user: mod } },
      );
      let changed: typeof review | undefined;
      classifyBottleReferenceMock.mockImplementationOnce(async () => {
        if (change === "removed") {
          await routerClient.admin.content.moderate(
            {
              kind: "external_review",
              id: review.id,
              removed: true,
              reason: "Not a review.",
            },
            { context: { user: mod } },
          );
        } else
          await db
            .update(externalReviews)
            .set(
              change === "assigned"
                ? { bottleId: bottle.id, bottleNoMatchAt: null }
                : change === "renamed"
                  ? { name: "Changed review" }
                  : { bottleNoMatchAt: new Date() },
            )
            .where(eq(externalReviews.id, review.id));
        changed = await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, review.id),
        });
        return buildClassification(
          {
            action,
            matchedBottleId: action === "match" ? bottle.id : undefined,
            candidateBottleIds: [bottle.id],
            referenceScope: "none",
          },
          { candidates: [{ bottleId: bottle.id }] },
        );
      });
      await createMissingBottles(
        workerClient.pushUniqueJob.mock.calls.at(-1)![1],
      );
      expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
      expect(
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, review.id),
        }),
      ).toEqual(changed);
      expect(await db.select().from(incomingBottleDecisionLogs)).toHaveLength(
        0,
      );
    },
  );

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
        reference: expect.objectContaining({ id: selected.id }),
      }),
    );
    // A supplied identity, even category-only, would skip text extraction.
    expect(classifyBottleReferenceMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "extractedIdentity",
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
      await db.query.bottleReferences.findFirst({
        where: eq(
          bottleReferences.name,
          normalizeBottleReferenceKey(review.name),
        ),
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
      decision: "match",
      bottleId: bottle.id,
    });
  });

  test("publishes a newly resolved review for an approved source", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewPublication({
      externalSiteId: site.id,
      approvedAt: new Date(),
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
