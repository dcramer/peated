import { db } from "@peated/server/db";
import {
  externalReviewBodies,
  externalReviews,
} from "@peated/server/db/schema";
import { CURRENT_REVIEW_VERSION } from "@peated/server/externalReviews/process";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import {
  updateExternalReviews,
  type UpdateExternalReviewServices,
} from "./updateExternalReviews";

function createServices(): UpdateExternalReviewServices {
  return {
    loadVocabulary: vi
      .fn<UpdateExternalReviewServices["loadVocabulary"]>()
      .mockResolvedValue([{ name: "smoke", synonyms: [] }]),
    processReview: vi
      .fn<UpdateExternalReviewServices["processReview"]>()
      .mockResolvedValue({
        clip: "A short review clip.",
        tags: ["smoke"],
        version: CURRENT_REVIEW_VERSION,
      }),
    updateBottle: vi
      .fn<UpdateExternalReviewServices["updateBottle"]>()
      .mockResolvedValue(undefined),
    queueNext: vi
      .fn<UpdateExternalReviewServices["queueNext"]>()
      .mockResolvedValue(undefined),
  };
}

test("updates old reviews from their saved bodies", async ({ fixtures }) => {
  const oldReview = await fixtures.ExternalReview({
    version: 0,
    tags: ["vanilla"],
    clip: "Old clip.",
  });
  const currentReview = await fixtures.ExternalReview({
    version: CURRENT_REVIEW_VERSION,
  });
  const missingBody = await fixtures.ExternalReview({ version: 0 });
  await db.insert(externalReviewBodies).values([
    {
      externalReviewId: oldReview.id,
      body: "Nose: smoke.",
      fetchedAt: new Date(),
    },
    {
      externalReviewId: currentReview.id,
      body: "Nose: vanilla.",
      fetchedAt: new Date(),
    },
  ]);
  const services = createServices();

  await expect(updateExternalReviews({}, services)).resolves.toEqual({
    updatedCount: 1,
    lastReviewId: oldReview.id,
  });

  expect(services.processReview).toHaveBeenCalledWith("Nose: smoke.", [
    { name: "smoke", synonyms: [] },
  ]);
  expect(services.updateBottle).toHaveBeenCalledWith(
    "externalReview",
    oldReview.id,
    oldReview.bottleId,
  );
  expect(services.queueNext).not.toHaveBeenCalled();
  expect(
    await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, oldReview.id),
    }),
  ).toMatchObject({
    clip: "A short review clip.",
    tags: ["smoke"],
    version: CURRENT_REVIEW_VERSION,
  });
  expect(
    await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, missingBody.id),
    }),
  ).toMatchObject({ version: 0 });
});
