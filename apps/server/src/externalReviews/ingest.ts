import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { storeReviewArticle } from "@peated/server/externalReviews/store";
import { generateExternalReviewSummary } from "@peated/server/externalReviews/summary";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import { logTelemetryError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = ReviewArticleIngestionSchema.safeExtend({
  externalSiteId: z.number().int().positive(),
  fetchedAt: z.date(),
});
type ReviewArticleIngestionCandidate = Partial<z.input<typeof InputSchema>>;

export interface ReviewIngestionServices {
  generateSummary: typeof generateExternalReviewSummary;
  queueMissingBottles: typeof pushUniqueJob;
  reportError: typeof logTelemetryError;
}

const reviewIngestionServices: ReviewIngestionServices = {
  generateSummary: generateExternalReviewSummary,
  queueMissingBottles: pushUniqueJob,
  reportError: logTelemetryError,
};

/** Stores the article before model-based Bottle resolution runs in a worker. */
export async function ingestReviewArticle(
  rawInput: ReviewArticleIngestionCandidate,
  services: ReviewIngestionServices = reviewIngestionServices,
) {
  const input = InputSchema.parse(rawInput);
  const site = await db.query.externalSites.findFirst({
    columns: { id: true },
    where: eq(externalSites.id, input.externalSiteId),
  });
  if (!site)
    throw new Error(`External site ${input.externalSiteId} not found.`);

  const storedReviews = [];

  for (const review of input.article.reviews) {
    const rawName = review.name;
    const { name: normalizedName } = normalizeBottle({ name: rawName });
    const aliasKey = normalizeBottleAliasKey(rawName);
    let aliasMatch = null;
    for (const aliasName of new Set([aliasKey, rawName])) {
      aliasMatch = await findBottleAliasAssignment(aliasName);
      if (aliasMatch) break;
    }
    let summary = null;
    const sourceText = input.reviewTexts[review.sourceKey];
    if (sourceText !== undefined) {
      try {
        summary = await services.generateSummary({
          externalSiteId: input.externalSiteId,
          sourceKey: review.sourceKey,
          bottleName: normalizedName,
          sourceText,
          contentHash: input.article.contentHash,
        });
      } catch {
        services.reportError("Unable to generate external review summary.", {
          extra: {
            review: {
              externalSiteId: input.externalSiteId,
              sourceKey: review.sourceKey,
              url: input.article.canonicalUrl,
            },
          },
        });
      }
    }
    storedReviews.push({
      ...review,
      bottleId: aliasMatch?.bottleId ?? null,
      summary,
    });
  }

  const result = await storeReviewArticle({
    externalSiteId: input.externalSiteId,
    fetchedAt: input.fetchedAt,
    ...input.article,
    reviews: storedReviews,
  });

  if (storedReviews.some((review) => review.bottleId === null)) {
    try {
      await services.queueMissingBottles(
        "CreateMissingBottles",
        { articleId: result.articleId },
        { removeOnComplete: true, removeOnFail: true },
      );
    } catch (error) {
      // The stored reviews are durable and a later ingestion or maintenance run
      // can queue their Bottle resolution again.
      services.reportError(error, {
        extra: {
          reviewArticleId: result.articleId,
          externalSiteId: input.externalSiteId,
        },
      });
    }
  }

  return result;
}
