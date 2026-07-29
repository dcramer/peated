import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import { fixBadReviewEntities } from "@peated/server/lib/fixBadReviewEntities";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const pushJobMock = vi.hoisted(() => vi.fn());
const pushUniqueJobMock = vi.hoisted(() => vi.fn());

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

describe("fixBadReviewEntities", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    pushJobMock.mockReset();
    pushUniqueJobMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
  });

  test("reassigns a mismatched review to the exact alias target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle({
      name: "Wrong Bottle",
      vintageYear: null,
      releaseYear: null,
    });
    const correctBottle = await fixtures.Bottle({
      name: "Correct Bottle",
      vintageYear: null,
      releaseYear: null,
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: wrongBottle.id,
        releaseId: null,
        name: correctBottle.fullName,
        issue: "Default",
        rating: 91,
        url: "https://example.com/review",
      })
      .returning();
    const [sameNameReview] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: null,
        releaseId: null,
        name: correctBottle.fullName,
        issue: "Second",
        rating: 88,
        url: "https://example.com/second-review",
      })
      .returning();
    const sameNamePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: correctBottle.fullName,
      url: "https://example.com/price",
    });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: correctBottle.id,
          candidateBottleIds: [correctBottle.id],
        },
        {
          candidates: [
            {
              bottleId: correctBottle.id,
              releaseId: null,
              fullName: correctBottle.fullName,
              bottleFullName: correctBottle.fullName,
              alias: correctBottle.fullName,
              brand: null,
              bottler: null,
              series: null,
              distillery: [],
              category: correctBottle.category,
              statedAge: correctBottle.statedAge,
              edition: null,
              caskStrength: correctBottle.caskStrength,
              singleCask: correctBottle.singleCask,
              abv: correctBottle.abv,
              vintageYear: correctBottle.vintageYear,
              releaseYear: correctBottle.releaseYear,
              caskType: correctBottle.caskType,
              caskSize: correctBottle.caskSize,
              caskFill: correctBottle.caskFill,
            },
          ],
        },
      ),
    );

    const summary = await fixBadReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(updatedReview?.bottleId).toEqual(correctBottle.id);
    expect(updatedReview?.releaseId).toBeNull();

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, review.name),
    });
    expect(alias).toMatchObject({
      bottleId: correctBottle.id,
    });

    const siblingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, sameNameReview.id),
    });
    expect(siblingReview?.bottleId).toEqual(correctBottle.id);

    const siblingPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, sameNamePrice.id),
    });
    expect(siblingPrice?.bottleId).toEqual(correctBottle.id);
    expect(pushUniqueJobMock).toHaveBeenCalledWith("IndexBottleSearchVectors", {
      bottleId: correctBottle.id,
    });
  });

  test("reassigns through an exact alias to an active Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle({
      name: "Wrong Staged Alias Bottle",
    });
    const stagedBottle = await fixtures.Bottle({
      name: "Staged Exact Alias Bottle",
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const alias = await fixtures.BottleAlias({
      bottleId: stagedBottle.id,
      releaseId: null,
      name: "Staged Exact Alias Review",
    });
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: wrongBottle.id,
        releaseId: null,
        name: alias.name,
        issue: "Default",
        rating: 90,
        url: "https://example.com/staged-exact-alias-review",
      })
      .returning();

    const summary = await fixBadReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: stagedBottle.id,
      releaseId: null,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("reassigns a classifier match to its direct active Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle({
      name: "Wrong Unpromoted Match Bottle",
    });
    const stagedParent = await fixtures.Bottle({
      name: "Unpromoted Match Parent",
    });
    const stagedRelease = await fixtures.BottleRelease({
      bottleId: stagedParent.id,
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: wrongBottle.id,
        releaseId: null,
        name: "Unpromoted Classifier Match Review",
        issue: "Default",
        rating: 90,
        url: "https://example.com/unpromoted-classifier-match-review",
      })
      .returning();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: stagedParent.id,
          candidateBottleIds: [stagedParent.id],
        },
        {
          candidates: [
            {
              bottleId: stagedParent.id,
              releaseId: stagedRelease.id,
              fullName: stagedRelease.fullName,
              bottleFullName: stagedParent.fullName,
            },
          ],
        },
      ),
    );

    const summary = await fixBadReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });
    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: stagedParent.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, review.name),
      }),
    ).toMatchObject({
      bottleId: stagedParent.id,
      releaseId: null,
      assignmentSource: "classifier_approved",
    });
  });

  test("leaves unresolved mismatches attached to the current bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Wrong Bottle",
      vintageYear: null,
      releaseYear: null,
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: bottle.id,
        releaseId: null,
        name: "Unknown Review Title",
        issue: "Default",
        rating: 90,
        url: "https://example.com/unresolved-review",
      })
      .returning();

    const summary = await fixBadReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 0,
      unresolved: 1,
      errored: 0,
      unchanged: 0,
    });

    const unchangedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toEqual(bottle.id);
    expect(unchangedReview?.releaseId).toBeNull();
  });

  test("counts classifier failures separately from unresolved mismatches", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Wrong Bottle",
      vintageYear: null,
      releaseYear: null,
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: bottle.id,
        releaseId: null,
        name: "Errored Review Title",
        issue: "Default",
        rating: 90,
        url: "https://example.com/errored-review",
      })
      .returning();

    classifyBottleReferenceMock.mockRejectedValueOnce(
      new Error("Classifier unavailable"),
    );

    const summary = await fixBadReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 0,
      unresolved: 0,
      errored: 1,
      unchanged: 0,
    });

    const unchangedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toEqual(bottle.id);
    expect(unchangedReview?.releaseId).toBeNull();
  });

  test("propagates alias assignment failures and rolls back Review changes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle({
      name: "Wrong Assignment Bottle",
    });
    const suggestedBottle = await fixtures.Bottle({
      name: "Suggested Assignment Bottle",
    });
    const conflictingBottle = await fixtures.Bottle({
      name: "Conflicting Assignment Bottle",
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: wrongBottle.id,
        name: "Assignment Conflict Review",
        issue: "Default",
        rating: 90,
        url: "https://example.com/assignment-conflict-review",
      })
      .returning();

    classifyBottleReferenceMock.mockImplementationOnce(async () => {
      await db
        .update(bottleAliases)
        .set({ name: review.name })
        .where(eq(bottleAliases.bottleId, conflictingBottle.id));
      return buildClassification(
        {
          action: "match",
          matchedBottleId: suggestedBottle.id,
          candidateBottleIds: [suggestedBottle.id],
        },
        {
          candidates: [
            {
              bottleId: suggestedBottle.id,
              releaseId: null,
              fullName: suggestedBottle.fullName,
              bottleFullName: suggestedBottle.fullName,
            },
          ],
        },
      );
    });

    await expect(fixBadReviewEntities({ user })).rejects.toThrow(
      /Cannot reserve exact Bottle alias/,
    );

    expect(
      await db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).toMatchObject({
      bottleId: wrongBottle.id,
      releaseId: null,
    });
  });

  test("does not overwrite a Review retargeted while classification runs", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle({ name: "Wrong Bottle" });
    const suggestedBottle = await fixtures.Bottle({ name: "Suggested Bottle" });
    const concurrentBottle = await fixtures.Bottle({
      name: "Concurrent Bottle",
    });
    const site = await fixtures.ExternalSiteOrExisting();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: site.id,
        bottleId: wrongBottle.id,
        name: "Suggested Bottle Review",
        issue: "Default",
        rating: 90,
        url: "https://example.com/concurrent-review",
      })
      .returning();

    classifyBottleReferenceMock.mockImplementationOnce(async () => {
      await db
        .update(reviews)
        .set({
          bottleId: concurrentBottle.id,
          releaseId: null,
        })
        .where(eq(reviews.id, review.id));
      return buildClassification(
        {
          action: "match",
          matchedBottleId: suggestedBottle.id,
          candidateBottleIds: [suggestedBottle.id],
        },
        {
          candidates: [
            {
              bottleId: suggestedBottle.id,
              releaseId: null,
              fullName: suggestedBottle.fullName,
              bottleFullName: suggestedBottle.fullName,
            },
          ],
        },
      );
    });

    const summary = await fixBadReviewEntities({ user });
    const preserved = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(summary).toMatchObject({ reassigned: 0, unchanged: 1 });
    expect(preserved).toMatchObject({
      bottleId: concurrentBottle.id,
      releaseId: null,
    });
  });
});
