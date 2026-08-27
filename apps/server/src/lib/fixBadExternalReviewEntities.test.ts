import { BottleClassificationResultSchema } from "@peated/bottle-classifier";
import type {
  BottleCandidate,
  BottleClassificationDecision,
} from "@peated/server/agents/bottleClassifier";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { fixBadExternalReviewEntities as fixBadExternalReviewEntitiesWithClassifier } from "@peated/server/lib/fixBadExternalReviewEntities";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock =
  vi.fn<
    NonNullable<
      Parameters<typeof fixBadExternalReviewEntitiesWithClassifier>[1]
    >
  >();

function fixBadExternalReviewEntities(
  input: Parameters<typeof fixBadExternalReviewEntitiesWithClassifier>[0],
) {
  return fixBadExternalReviewEntitiesWithClassifier(
    input,
    classifyBottleReferenceMock,
  );
}

type MockClassificationDecision = Pick<
  BottleClassificationDecision,
  "action"
> & {
  candidateBottleIds?: number[];
  matchedBottleId?: number;
};

type MockClassificationArtifacts = {
  candidates?: Array<
    Partial<BottleCandidate> & Pick<BottleCandidate, "bottleId" | "fullName">
  >;
};

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
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
      ...artifacts,
    },
  });
}

describe("fixBadExternalReviewEntities", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    vi.mocked(workerClient.pushUniqueJob).mockReset();
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: wrongBottle.id,
      name: correctBottle.fullName,
      issue: "Default",
      legacyNormalizedScore: 91,
      url: "https://example.com/review",
    });
    const sameNameReview = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      name: correctBottle.fullName,
      issue: "Second",
      legacyNormalizedScore: 88,
      url: "https://example.com/second-review",
    });
    const sameNamePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
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
              fullName: correctBottle.fullName,
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
              maturation: correctBottle.maturation,
              caskNumber: correctBottle.caskNumber,
              outturn: correctBottle.outturn,
            },
          ],
        },
      ),
    );

    const summary = await fixBadExternalReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });

    const updatedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(updatedReview?.bottleId).toEqual(correctBottle.id);

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, review.name),
    });
    expect(alias).toMatchObject({
      bottleId: correctBottle.id,
    });

    const siblingReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, sameNameReview.id),
    });
    expect(siblingReview?.bottleId).toEqual(correctBottle.id);

    const siblingPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, sameNamePrice.id),
    });
    expect(siblingPrice?.bottleId).toEqual(correctBottle.id);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      {
        bottleId: correctBottle.id,
      },
    );
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
      name: "Staged Exact Alias Review",
    });
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: wrongBottle.id,
      name: alias.name,
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/staged-exact-alias-review",
    });

    const summary = await fixBadExternalReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: stagedBottle.id,
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
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: wrongBottle.id,
      name: "Unpromoted Classifier Match Review",
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/unpromoted-classifier-match-review",
    });
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
              fullName: stagedParent.fullName,
            },
          ],
        },
      ),
    );

    const summary = await fixBadExternalReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 1,
      unresolved: 0,
      errored: 0,
      unchanged: 0,
    });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: stagedParent.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, review.name),
      }),
    ).toMatchObject({
      bottleId: stagedParent.id,
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      name: "Unknown Review Title",
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/unresolved-review",
    });

    const summary = await fixBadExternalReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 0,
      unresolved: 1,
      errored: 0,
      unchanged: 0,
    });

    const unchangedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toEqual(bottle.id);
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      name: "Errored Review Title",
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/errored-review",
    });

    classifyBottleReferenceMock.mockRejectedValueOnce(
      new Error("Classifier unavailable"),
    );

    const summary = await fixBadExternalReviewEntities({ user });

    expect(summary).toEqual({
      scanned: 1,
      reassigned: 0,
      unresolved: 0,
      errored: 1,
      unchanged: 0,
    });

    const unchangedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toEqual(bottle.id);
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: wrongBottle.id,
      name: "Assignment Conflict Review",
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/assignment-conflict-review",
    });

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
              fullName: suggestedBottle.fullName,
            },
          ],
        },
      );
    });

    await expect(fixBadExternalReviewEntities({ user })).rejects.toThrow(
      /Cannot reserve exact Bottle alias/,
    );

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: wrongBottle.id,
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
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: wrongBottle.id,
      name: "Suggested Bottle Review",
      issue: "Default",
      legacyNormalizedScore: 90,
      url: "https://example.com/concurrent-review",
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
        {
          candidates: [
            {
              bottleId: suggestedBottle.id,
              fullName: suggestedBottle.fullName,
            },
          ],
        },
      );
    });

    const summary = await fixBadExternalReviewEntities({ user });
    const preserved = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
    });

    expect(summary).toMatchObject({ reassigned: 0, unchanged: 1 });
    expect(preserved).toMatchObject({
      bottleId: concurrentBottle.id,
    });
  });
});
