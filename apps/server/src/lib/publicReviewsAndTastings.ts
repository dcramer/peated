import {
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  memberReviews,
  tastings,
  users,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { inArray, sql } from "drizzle-orm";

/**
 * Selects public reviews and tastings for specific Bottles.
 *
 * Callers must provide Bottle IDs so summary jobs cannot accidentally scan all
 * review and tasting history. Signed-in lists use separate access rules because
 * private member activity never enters public Bottle statistics.
 */
export function publicReviewsAndTastings(bottleIds: readonly number[]) {
  if (!bottleIds.length) {
    throw new Error(
      "Public review-and-tasting records require a Bottle scope.",
    );
  }
  const scopedBottleIds = [...bottleIds];

  return sql`
    SELECT 'tasting'::text AS kind, ${tastings.id} AS review_or_tasting_id,
      ${tastings.bottleId} AS bottle_id, ${tastings.createdAt} AS occurred_at,
      ${tastings.tags} AS note_names
    FROM ${tastings}
    INNER JOIN ${users} ON ${users.id} = ${tastings.createdById}
      AND ${users.private} = FALSE
    WHERE ${inArray(tastings.bottleId, scopedBottleIds)}
      AND ${tastings.removedAt} IS NULL

    UNION ALL

    SELECT 'member_review'::text AS kind,
      ${memberReviews.id} AS review_or_tasting_id,
      ${memberReviews.bottleId} AS bottle_id,
      ${memberReviews.createdAt} AS occurred_at,
      ${memberReviews.tags} AS note_names
    FROM ${memberReviews}
    INNER JOIN ${users} ON ${users.id} = ${memberReviews.createdById}
      AND ${users.private} = FALSE
    WHERE ${inArray(memberReviews.bottleId, scopedBottleIds)}
      AND ${memberReviews.removedAt} IS NULL

    UNION ALL

    SELECT 'critic_review'::text AS kind,
      ${externalReviews.id} AS review_or_tasting_id,
      ${externalReviews.bottleId} AS bottle_id,
      COALESCE(${externalReviewArticles.publishedAt}, ${externalReviews.createdAt})
        AS occurred_at,
      ${externalReviews.tags} AS note_names
    FROM ${externalReviews}
    INNER JOIN ${externalReviewArticles}
      ON ${externalReviewArticles.id} = ${externalReviews.articleId}
    LEFT JOIN ${externalReviewPublications}
      ON ${externalReviewPublications.externalSiteId} =
        ${externalReviewArticles.externalSiteId}
    WHERE ${visibleExternalReviewWhere()}
      AND ${inArray(externalReviews.bottleId, scopedBottleIds)}
  `;
}
