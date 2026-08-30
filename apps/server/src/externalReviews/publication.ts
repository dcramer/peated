import type { AnyTransaction } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

/** Locks the source before a transaction decides review visibility. */
export async function isExternalReviewPublicationApprovedInTransaction(
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

  const publication = await tx.query.externalReviewPublications.findFirst({
    columns: { approvedAt: true },
    where: eq(externalReviewPublications.externalSiteId, externalSiteId),
  });
  return publication?.approvedAt != null;
}

/** Publishes one newly resolved review when its assigned Bottle is active. */
export async function publishResolvedReview(
  tx: AnyTransaction,
  externalSiteId: number,
  reviewId: number,
) {
  const [publishable] = await tx
    .select({ id: externalReviews.id })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .innerJoin(bottles, eq(externalReviews.bottleId, bottles.id))
    .leftJoin(
      bottleTombstones,
      eq(externalReviews.bottleId, bottleTombstones.bottleId),
    )
    .where(
      and(
        eq(externalReviews.id, reviewId),
        eq(externalReviewArticles.externalSiteId, externalSiteId),
        eq(externalReviews.hidden, true),
        isNotNull(externalReviews.bottleId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .limit(1)
    .for("update", { of: externalReviews });
  if (!publishable) return;

  await tx
    .update(externalReviews)
    .set({ hidden: false, updatedAt: sql`NOW()` })
    .where(eq(externalReviews.id, publishable.id));
}

/** Publishes staged external reviews only when their assigned Bottle is active. */
export async function publishResolvedReviews(
  tx: AnyTransaction,
  externalSiteId: number,
) {
  const publishable = await tx
    .select({ id: externalReviews.id })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .innerJoin(bottles, eq(externalReviews.bottleId, bottles.id))
    .leftJoin(
      bottleTombstones,
      eq(externalReviews.bottleId, bottleTombstones.bottleId),
    )
    .where(
      and(
        eq(externalReviewArticles.externalSiteId, externalSiteId),
        eq(externalReviews.hidden, true),
        isNotNull(externalReviews.bottleId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .for("update", { of: externalReviews });

  if (!publishable.length) return;

  await tx
    .update(externalReviews)
    .set({ hidden: false, updatedAt: sql`NOW()` })
    .where(
      inArray(
        externalReviews.id,
        publishable.map(({ id }) => id),
      ),
    );
}
