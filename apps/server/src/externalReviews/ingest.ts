import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ReviewArticleObservationSchema } from "@peated/server/externalReviews/observation";
import { storeReviewArticle } from "@peated/server/externalReviews/store";
import { generateExternalReviewSummary } from "@peated/server/externalReviews/summary";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { resolveScrapedBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { logError, logTelemetryError } from "@peated/server/lib/log";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    article: ReviewArticleObservationSchema,
    reviewTexts: z.record(z.string(), z.string()).default({}),
  })
  .strict()
  .superRefine(({ article, reviewTexts }, context) => {
    const sourceKeys = new Set(
      article.reviews.map(({ sourceKey }) => sourceKey),
    );
    for (const sourceKey of Object.keys(reviewTexts)) {
      if (!sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          message: "Review text must match a review source key.",
          path: ["reviewTexts", sourceKey],
        });
      }
    }
  });

/** Resolves each review to a Bottle, then stores the article with hidden reviews. */
export async function ingestReviewArticle(rawInput: unknown) {
  const input = InputSchema.parse(rawInput);
  const site = await db.query.externalSites.findFirst({
    columns: { id: true },
    where: eq(externalSites.id, input.externalSiteId),
  });
  if (!site)
    throw new Error(`External site ${input.externalSiteId} not found.`);

  const actor = await getPeatedSystemActor();
  const resolvedReviews = [];

  for (const review of input.article.reviews) {
    const rawName = review.name;
    const { name: normalizedName } = normalizeBottle({ name: rawName });
    const aliasKey = normalizeBottleAliasKey(rawName);
    const resolution = await resolveScrapedBottleReferenceTarget({
      reference: {
        externalSiteId: input.externalSiteId,
        name: rawName,
        url: input.article.canonicalUrl,
        imageUrl: null,
        currentBottleId: null,
      },
      aliasLookupNames: [aliasKey, rawName],
      createdByActorId: actor.id,
    });
    if (resolution.error) {
      logError(resolution.error, {
        review: {
          externalSiteId: input.externalSiteId,
          name: rawName,
          url: input.article.canonicalUrl,
        },
      });
    }
    let summary = null;
    const sourceText = input.reviewTexts[review.sourceKey];
    if (sourceText !== undefined) {
      try {
        summary = await generateExternalReviewSummary({
          externalSiteId: input.externalSiteId,
          sourceKey: review.sourceKey,
          bottleName: normalizedName,
          sourceText,
          contentHash: input.article.contentHash,
        });
      } catch {
        logTelemetryError("Unable to generate external review summary.", {
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
    resolvedReviews.push({
      ...review,
      bottleId: resolution.assignment?.bottleId ?? null,
      summary,
    });
  }

  return await storeReviewArticle({
    externalSiteId: input.externalSiteId,
    fetchedAt: input.fetchedAt,
    ...input.article,
    reviews: resolvedReviews,
  });
}
