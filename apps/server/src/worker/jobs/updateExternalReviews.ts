import { db } from "@peated/server/db";
import {
  externalReviewBodies,
  externalReviews,
} from "@peated/server/db/schema";
import {
  CURRENT_REVIEW_VERSION,
  loadReviewVocabulary,
  processExternalReview,
} from "@peated/server/externalReviews/process";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

const PAGE_SIZE = 25;

const InputSchema = z
  .object({ afterReviewId: z.number().int().positive().optional() })
  .strict();

export type UpdateExternalReviewServices = {
  loadVocabulary: typeof loadReviewVocabulary;
  processReview: typeof processExternalReview;
  updateBottle: typeof dispatchBottleStatsRecompute;
  queueNext: typeof pushUniqueJob;
};

const defaultServices: UpdateExternalReviewServices = {
  loadVocabulary: loadReviewVocabulary,
  processReview: processExternalReview,
  updateBottle: dispatchBottleStatsRecompute,
  queueNext: pushUniqueJob,
};

/** Updates saved external reviews that were processed by older code. */
export async function updateExternalReviews(
  rawInput: JobPayload,
  services: UpdateExternalReviewServices = defaultServices,
) {
  const { afterReviewId } = InputSchema.parse(rawInput ?? {});
  const reviews = await db
    .select({
      id: externalReviews.id,
      bottleId: externalReviews.bottleId,
      body: externalReviewBodies.body,
    })
    .from(externalReviews)
    .innerJoin(
      externalReviewBodies,
      eq(externalReviewBodies.externalReviewId, externalReviews.id),
    )
    .where(
      and(
        lt(externalReviews.version, CURRENT_REVIEW_VERSION),
        afterReviewId ? gt(externalReviews.id, afterReviewId) : undefined,
      ),
    )
    .orderBy(asc(externalReviews.id))
    .limit(PAGE_SIZE);

  if (!reviews.length) return { updatedCount: 0, lastReviewId: null };

  const vocabulary = await services.loadVocabulary();
  let updatedCount = 0;

  for (const review of reviews) {
    const processed = await services.processReview(review.body, vocabulary);
    const values: Partial<typeof externalReviews.$inferInsert> = {
      tags: processed.tags,
      version: processed.version,
      updatedAt: new Date(),
    };
    if (processed.clip) values.clip = processed.clip;
    const [updated] = await db
      .update(externalReviews)
      .set(values)
      .where(
        and(
          eq(externalReviews.id, review.id),
          lt(externalReviews.version, CURRENT_REVIEW_VERSION),
        ),
      )
      .returning({ id: externalReviews.id });
    if (!updated) continue;
    updatedCount += 1;
    if (review.bottleId) {
      await services.updateBottle("externalReview", review.id, review.bottleId);
    }
  }

  const lastReviewId = reviews.at(-1)?.id ?? null;
  if (reviews.length === PAGE_SIZE && lastReviewId) {
    await services.queueNext(
      "UpdateExternalReviews",
      { afterReviewId: lastReviewId },
      { removeOnComplete: true, removeOnFail: false },
    );
  }

  return { updatedCount, lastReviewId };
}

export default async function updateExternalReviewsJob(rawInput: JobPayload) {
  return await updateExternalReviews(rawInput);
}
