import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { bottles, reviews } from "@peated/server/db/schema";
import { assignBottleAlias } from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { and, eq, ne } from "drizzle-orm";

export type FixBadReviewEntitiesResult = {
  scanned: number;
  reassigned: number;
  unresolved: number;
  errored: number;
  unchanged: number;
};

/**
 * Re-resolve reviews whose linked bottle no longer matches the review title.
 *
 * This stays intentionally conservative: it never rewrites or deletes the
 * current bottle record. It only reassigns the review when an exact alias or
 * reviewed classifier result returns a concrete replacement target.
 */
export async function fixBadReviewEntities({
  user,
}: {
  user: User;
}): Promise<FixBadReviewEntitiesResult> {
  const results = await db
    .select({ bottle: bottles, review: reviews })
    .from(bottles)
    .innerJoin(
      reviews,
      and(eq(reviews.bottleId, bottles.id), ne(reviews.name, bottles.fullName)),
    );

  const summary: FixBadReviewEntitiesResult = {
    scanned: 0,
    reassigned: 0,
    unresolved: 0,
    errored: 0,
    unchanged: 0,
  };

  for (const { bottle, review } of results) {
    if (review.name.startsWith(bottle.fullName)) {
      continue;
    }

    summary.scanned += 1;

    const resolution = await resolveBottleReferenceTarget({
      reference: {
        id: review.id,
        externalSiteId: review.externalSiteId,
        name: review.name,
        url: review.url,
        imageUrl: null,
        currentBottleId: review.bottleId,
        currentReleaseId: review.releaseId,
      },
      // Review cleanup uses the same conservative alias rule as live ingest:
      // normalized fallback aliases can erase release markers before the
      // classifier sees the real reference title.
      aliasLookupNames: [review.name],
      user,
    });

    if (!resolution.bottleId) {
      if (resolution.error) {
        summary.errored += 1;
        continue;
      }

      summary.unresolved += 1;
      continue;
    }

    const targetBottleId = resolution.bottleId;
    const targetReleaseId = resolution.releaseId;
    const isSameTarget =
      targetBottleId === review.bottleId &&
      targetReleaseId === review.releaseId;

    if (isSameTarget) {
      await assignBottleAlias({
        bottleId: targetBottleId,
        releaseId: targetReleaseId,
        name: review.name,
      });

      summary.unchanged += 1;
      continue;
    }

    await assignBottleAlias({
      bottleId: targetBottleId,
      releaseId: targetReleaseId,
      name: review.name,
    });

    summary.reassigned += 1;
  }

  return summary;
}
