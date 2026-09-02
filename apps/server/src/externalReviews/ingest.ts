import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { createReviewClip } from "@peated/server/externalReviews/clip";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { storeExternalReviewArticle } from "@peated/server/externalReviews/store";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { logTelemetryError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = ExternalReviewArticleIngestionSchema.safeExtend({
  externalSiteId: z.number().int().positive(),
  fetchedAt: z.date(),
});
type ExternalReviewArticleIngestionCandidate = Partial<
  z.input<typeof InputSchema>
>;

export interface ExternalReviewIngestionServices {
  createClip: typeof createReviewClip;
  queueMissingBottles: typeof pushUniqueJob;
  reportError: typeof logTelemetryError;
}

const externalReviewIngestionServices: ExternalReviewIngestionServices = {
  createClip: createReviewClip,
  queueMissingBottles: pushUniqueJob,
  reportError: logTelemetryError,
};

/** Stores the article before model-based Bottle resolution runs in a worker. */
export async function ingestExternalReviewArticle(
  rawInput: ExternalReviewArticleIngestionCandidate,
  services: ExternalReviewIngestionServices = externalReviewIngestionServices,
) {
  const input = InputSchema.parse(rawInput);
  const site = await db.query.externalSites.findFirst({
    columns: { id: true },
    where: eq(externalSites.id, input.externalSiteId),
  });
  if (!site)
    throw new Error(`External site ${input.externalSiteId} not found.`);

  const storedExternalReviews = [];

  for (const externalReview of input.article.externalReviews) {
    const rawName = externalReview.name;
    const referenceKey = normalizeBottleReferenceKey(rawName);
    let referenceMatch = null;
    for (const referenceName of new Set([referenceKey, rawName])) {
      referenceMatch = await findBottleReferenceAssignment(referenceName);
      if (referenceMatch) break;
    }
    const reviewText = input.externalReviewTexts[externalReview.sourceKey];
    const clip = reviewText ? await services.createClip(reviewText) : null;
    storedExternalReviews.push({
      ...externalReview,
      bottleId: referenceMatch?.bottleId ?? null,
      clip: clip ?? undefined,
    });
  }

  const result = await storeExternalReviewArticle({
    externalSiteId: input.externalSiteId,
    fetchedAt: input.fetchedAt,
    ...input.article,
    externalReviews: storedExternalReviews,
  });

  if (
    storedExternalReviews.some(
      (externalReview) => externalReview.bottleId === null,
    )
  ) {
    try {
      await services.queueMissingBottles(
        "CreateMissingBottles",
        { articleId: result.articleId },
        { removeOnComplete: true, removeOnFail: true },
      );
    } catch (error) {
      // The stored external reviews are durable. A later ingestion or
      // maintenance run can queue their Bottle resolution again.
      services.reportError(error, {
        extra: {
          externalReviewArticleId: result.articleId,
          externalSiteId: input.externalSiteId,
        },
      });
    }
  }

  return result;
}
