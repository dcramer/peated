import type { AnyTransaction } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

/** Publishes staged reviews only when their assigned Bottle is still active. */
export async function publishResolvedReviews(
  tx: AnyTransaction,
  externalSiteId: number,
) {
  const publishable = await tx
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(reviewArticles, eq(reviews.articleId, reviewArticles.id))
    .innerJoin(bottles, eq(reviews.bottleId, bottles.id))
    .leftJoin(bottleTombstones, eq(reviews.bottleId, bottleTombstones.bottleId))
    .where(
      and(
        eq(reviewArticles.externalSiteId, externalSiteId),
        eq(reviews.hidden, true),
        isNotNull(reviews.bottleId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .for("update", { of: reviews });

  if (!publishable.length) return;

  await tx
    .update(reviews)
    .set({ hidden: false, updatedAt: sql`NOW()` })
    .where(
      inArray(
        reviews.id,
        publishable.map(({ id }) => id),
      ),
    );
}
