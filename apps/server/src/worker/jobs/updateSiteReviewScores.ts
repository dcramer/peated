import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
  externalSiteConfig,
  externalSites,
} from "@peated/server/db/schema";
import { loadReviewScoringSettings } from "@peated/server/externalReviews/scoringSettings";
import { REVIEW_SCORING_CONFIG_KEY } from "@peated/server/schemas/externalReviewScoring";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";
import updateBottleStats from "./updateBottleStats";

const InputSchema = z.object({ siteId: z.number().int().positive() }).strict();

/** Ratings retries from stored source values; stale jobs cannot clear a newer refresh. */
export default async function updateSiteReviewScores(rawInput: JobPayload) {
  const { siteId } = InputSchema.parse(rawInput);
  const initial = (await loadReviewScoringSettings([siteId])).get(siteId);
  if (!initial) return;
  let after = 0;
  while (true) {
    const batch = await db
      .selectDistinct({ bottleId: externalReviews.bottleId })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviewArticles.id, externalReviews.articleId),
      )
      .where(
        and(
          eq(externalReviewArticles.externalSiteId, siteId),
          gt(externalReviews.bottleId, after),
        ),
      )
      .orderBy(asc(externalReviews.bottleId))
      .limit(100);
    if (!batch.length) break;
    for (const { bottleId } of batch) {
      if (bottleId === null) throw new Error("Expected an assigned review.");
      await updateBottleStats({ bottleId });
      after = bottleId;
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .select({ id: externalSites.id })
      .from(externalSites)
      .where(eq(externalSites.id, siteId))
      .for("update");
    const current = (await loadReviewScoringSettings([siteId], tx)).get(siteId);
    if (!current || current.version !== initial.version) return;
    await tx
      .update(externalSiteConfig)
      .set({
        value: { ...current, recomputePending: false },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(externalSiteConfig.externalSiteId, siteId),
          eq(externalSiteConfig.key, REVIEW_SCORING_CONFIG_KEY),
        ),
      );
  });
}
