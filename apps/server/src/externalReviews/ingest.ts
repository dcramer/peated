import { normalizeBottleAliasKey } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ExternalReviewArticleObservationSchema } from "@peated/server/externalReviews/observation";
import { storeExternalReviewArticle } from "@peated/server/externalReviews/store";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import { logTelemetryError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    article: ExternalReviewArticleObservationSchema,
  })
  .strict();
type ExternalReviewArticleIngestionCandidate = Partial<
  z.input<typeof InputSchema>
>;

export interface ExternalReviewIngestionServices {
  queueMissingBottles: typeof pushUniqueJob;
  reportError: typeof logTelemetryError;
}

const externalReviewIngestionServices: ExternalReviewIngestionServices = {
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
    const aliasKey = normalizeBottleAliasKey(rawName);
    let aliasMatch = null;
    for (const aliasName of new Set([aliasKey, rawName])) {
      aliasMatch = await findBottleAliasAssignment(aliasName);
      if (aliasMatch) break;
    }
    storedExternalReviews.push({
      ...externalReview,
      bottleId: aliasMatch?.bottleId ?? null,
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
