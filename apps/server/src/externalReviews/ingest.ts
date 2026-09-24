import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { createReviewClip } from "@peated/server/externalReviews/clip";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import {
  loadReviewVocabulary,
  processExternalReview,
} from "@peated/server/externalReviews/process";
import { storeExternalReviewArticle } from "@peated/server/externalReviews/store";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { logTelemetryError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, eq } from "drizzle-orm";
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
  const vocabulary =
    Object.keys(input.externalReviewTexts).length ||
    Object.keys(input.externalReviewBodies).length
      ? await loadReviewVocabulary()
      : [];
  const savedClips = await loadSavedClips(
    input.externalSiteId,
    input.article.canonicalUrl,
  );
  let modelCallCount = 0;
  const createClip: typeof services.createClip = async (text) => {
    modelCallCount += 1;
    return await services.createClip(text);
  };

  for (const externalReview of input.article.externalReviews) {
    const rawName = externalReview.name;
    const referenceKey = normalizeBottleReferenceKey(rawName);
    let referenceMatch = null;
    for (const referenceName of new Set([referenceKey, rawName])) {
      referenceMatch = await findBottleReferenceAssignment(referenceName);
      if (referenceMatch) break;
    }
    const body =
      input.externalReviewBodies[externalReview.sourceKey] ??
      input.externalReviewTexts[externalReview.sourceKey];
    // Sources re-read their recent articles on every run. An unchanged body
    // keeps its saved clip instead of asking the model again. A review
    // without a clip is tried again in case an earlier request failed.
    const saved = savedClips.get(externalReview.sourceKey);
    const savedClip =
      body !== undefined && saved?.body === body ? saved.clip : null;
    const processed = body
      ? await processExternalReview(
          body,
          vocabulary,
          savedClip === null ? createClip : async () => savedClip,
        )
      : null;
    storedExternalReviews.push({
      ...externalReview,
      bottleId: referenceMatch?.bottleId ?? null,
      clip: processed?.clip ?? undefined,
      body,
      tags: processed?.tags,
      version: processed?.version,
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

  return { ...result, modelCallCount };
}

async function loadSavedClips(externalSiteId: number, canonicalUrl: string) {
  const rows = await db
    .select({
      sourceKey: externalReviews.sourceKey,
      clip: externalReviews.clip,
      body: externalReviewBodies.body,
    })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .leftJoin(
      externalReviewBodies,
      eq(externalReviewBodies.externalReviewId, externalReviews.id),
    )
    .where(
      and(
        eq(externalReviewArticles.externalSiteId, externalSiteId),
        eq(externalReviewArticles.canonicalUrl, canonicalUrl),
      ),
    );
  return new Map(
    rows.flatMap((row) =>
      row.sourceKey === null
        ? []
        : [[row.sourceKey, { body: row.body, clip: row.clip }] as const],
    ),
  );
}
