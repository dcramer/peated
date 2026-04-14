import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { assignBottleAlias } from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { and, asc, gt, isNull } from "drizzle-orm";

export default async function createMissingBottles() {
  const systemUser = await getAutomationModeratorUser();

  // Advance by id so unresolved reviews are visited once per run instead of
  // hot-looping forever on the same null bottle assignments.
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const missingInReviews = await db
      .select()
      .from(reviews)
      .where(and(isNull(reviews.bottleId), gt(reviews.id, cursor)))
      .orderBy(asc(reviews.id))
      .limit(100);

    hasMore = missingInReviews.length > 0;
    if (!hasMore) break;

    for (const review of missingInReviews) {
      cursor = review.id;

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
        // Backfill uses the same conservative rule as live review ingestion:
        // only raw exact aliases are trusted before classifier review because a
        // normalized fallback can collapse real release detail to the parent.
        aliasLookupNames: [review.name],
        user: systemUser,
      });

      if (resolution.bottleId) {
        console.log(
          `Resolved bottle for review [${review.id}] via ${resolution.source}`,
        );
      } else {
        console.log(`Unable to resolve bottle for review [${review.id}]`);
        if (resolution.error) {
          console.error(resolution.error);
        }
        continue;
      }

      await assignBottleAlias({
        bottleId: resolution.bottleId,
        releaseId: resolution.releaseId,
        name: review.name,
      });
    }
  }
}
