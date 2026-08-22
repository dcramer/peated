import type { AnyTransaction } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  externalReviewSourcePolicies,
  externalSites,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

/** Locks the source policy before a transaction decides review visibility. */
export async function getExternalReviewPublicationModeInTransaction(
  tx: AnyTransaction,
  externalSiteId: number,
) {
  const [source] = await tx
    .select({ id: externalSites.id })
    .from(externalSites)
    .where(eq(externalSites.id, externalSiteId))
    .limit(1)
    .for("share");
  if (!source) throw new Error(`External site ${externalSiteId} not found.`);

  const policy = await tx.query.externalReviewSourcePolicies.findFirst({
    columns: { publicationMode: true },
    where: eq(externalReviewSourcePolicies.externalSiteId, externalSiteId),
  });
  return policy?.publicationMode ?? "disabled";
}

/** Publishes one newly resolved review when its assigned Bottle is active. */
export async function publishResolvedReview(
  tx: AnyTransaction,
  externalSiteId: number,
  reviewId: number,
) {
  const [publishable] = await tx
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(reviewArticles, eq(reviews.articleId, reviewArticles.id))
    .innerJoin(bottles, eq(reviews.bottleId, bottles.id))
    .leftJoin(bottleTombstones, eq(reviews.bottleId, bottleTombstones.bottleId))
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviewArticles.externalSiteId, externalSiteId),
        eq(reviews.hidden, true),
        isNotNull(reviews.bottleId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .limit(1)
    .for("update", { of: reviews });
  if (!publishable) return;

  await tx
    .update(reviews)
    .set({ hidden: false, updatedAt: sql`NOW()` })
    .where(eq(reviews.id, publishable.id));
}

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
