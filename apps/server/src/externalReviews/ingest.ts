import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { ReviewArticleObservationSchema } from "@peated/server/externalReviews/observation";
import { storeReviewArticle } from "@peated/server/externalReviews/store";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { resolveScrapedBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { logError } from "@peated/server/lib/log";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    article: ReviewArticleObservationSchema,
  })
  .strict();

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
    const { name } = normalizeBottle({ name: rawName });
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
    resolvedReviews.push({
      ...review,
      name,
      bottleId: resolution.assignment?.bottleId ?? null,
    });
  }

  return await storeReviewArticle({
    externalSiteId: input.externalSiteId,
    fetchedAt: input.fetchedAt,
    ...input.article,
    reviews: resolvedReviews,
  });
}
