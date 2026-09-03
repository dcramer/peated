import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
} from "@peated/server/db/schema";
import type { ExternalReviewScoringPolicy } from "@peated/server/schemas/externalReviewScoring";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { convertExternalReviewScore } from "./scoring";
import { loadReviewScoringSettings } from "./scoringSettings";
import { visibleExternalReviewWhere } from "./visibility";

export type ReviewScoringOverride = {
  siteId: number;
  policy: ExternalReviewScoringPolicy;
};

/** Shared reader for summaries, score explanations, previews, and maintenance. */
export async function loadScoredExternalReviews(
  scope: {
    bottleIds?: number[];
    reviewIds?: number[];
    siteId?: number;
    limit?: number;
  },
  conn: AnyDatabase = db,
  override?: ReviewScoringOverride,
) {
  if (scope.bottleIds?.length === 0 || scope.reviewIds?.length === 0) return [];
  const query = conn
    .select({
      id: externalReviews.id,
      bottleId: externalReviews.bottleId,
      siteId: externalReviewArticles.externalSiteId,
      name: externalReviews.name,
      url: externalReviewArticles.canonicalUrl,
      publishedAt: externalReviewArticles.publishedAt,
      value: externalReviews.nativeScoreValue,
      scale: externalReviews.nativeScoreScale,
      display: externalReviews.nativeScoreDisplay,
      public: sql<boolean>`COALESCE(${visibleExternalReviewWhere()}, false)`,
      retired: sql<boolean>`EXISTS (SELECT 1 FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${externalReviews.bottleId})`,
    })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviewArticles.id, externalReviews.articleId),
    )
    .leftJoin(
      externalReviewPublications,
      eq(
        externalReviewPublications.externalSiteId,
        externalReviewArticles.externalSiteId,
      ),
    )
    .where(
      and(
        scope.bottleIds
          ? inArray(externalReviews.bottleId, scope.bottleIds)
          : undefined,
        scope.reviewIds
          ? inArray(externalReviews.id, scope.reviewIds)
          : undefined,
        scope.siteId !== undefined
          ? eq(externalReviewArticles.externalSiteId, scope.siteId)
          : undefined,
      ),
    )
    .orderBy(desc(externalReviews.id));
  const rows = await (scope.limit === undefined
    ? query
    : query.limit(scope.limit));
  const settings = await loadReviewScoringSettings(
    [...new Set(rows.map((row) => row.siteId))],
    conn,
  );
  return rows.map((row) => {
    const nativeScore =
      row.value !== null && row.scale !== null && row.display !== null
        ? { value: row.value, scale: row.scale, display: row.display }
        : null;
    const policy =
      override?.siteId === row.siteId
        ? override.policy
        : (settings.get(row.siteId)?.policy ?? null);
    const conversion = convertExternalReviewScore(
      nativeScore,
      row.publishedAt,
      policy,
    );
    const contribution = !row.public
      ? { ...conversion, value: null, reason: "not_public" as const }
      : row.bottleId === null || row.retired
        ? { ...conversion, value: null, reason: "unmatched" as const }
        : conversion;
    return {
      id: row.id,
      bottleId: row.bottleId,
      siteId: row.siteId,
      name: row.name,
      url: row.url,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      nativeScore,
      conversion,
      contribution,
    };
  });
}
