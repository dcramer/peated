import {
  EMPTY_TASTING_BAND_COUNTS,
  MIN_BOTTLE_SCORE_COUNT,
} from "@peated/server/constants";
import type { AnyTransaction } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { countedExternalReviewScoreWhere } from "@peated/server/lib/externalReviewScores";
import { inArray, sql } from "drizzle-orm";

export type BottleActivityStats = Pick<
  Bottle,
  | "totalTastings"
  | "medianScore"
  | "minScore"
  | "maxScore"
  | "memberScoreCount"
  | "externalScoreCount"
  | "tastingBandCounts"
>;

type RawBottleActivityStats = {
  totalTastings: number | string;
  mediocre: number | string;
  good: number | string;
  veryGood: number | string;
  outstanding: number | string;
  unicorn: number | string;
  memberScoreCount: number | string;
  externalScoreCount: number | string;
  medianScore: number | string | null;
  minScore: number | string | null;
  maxScore: number | string | null;
};

export class BottleActivityStatsAggregationError extends Error {
  constructor() {
    super("Unable to aggregate Bottle activity statistics.");
    this.name = "BottleActivityStatsAggregationError";
  }
}

function requiredCount(value: number | string): number {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    throw new BottleActivityStatsAggregationError();
  }
  return count;
}

function requiredScore(value: number | string | null): number | null {
  if (value === null) return null;
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new BottleActivityStatsAggregationError();
  }
  return score;
}

/** Aggregates current tasting bands and counted review scores for active Bottles. */
export async function aggregateBottleActivityStatsInTransaction(
  tx: AnyTransaction,
  bottleIds: number[],
): Promise<BottleActivityStats> {
  const externalWhere = countedExternalReviewScoreWhere();
  const result = await tx.execute<RawBottleActivityStats>(sql`
    WITH score_values AS (
      SELECT ${memberReviews.score}::integer AS score, 'member'::text AS source
      FROM ${memberReviews}
      WHERE ${inArray(memberReviews.bottleId, bottleIds)}

      UNION ALL

      SELECT ${externalReviews.nativeScoreValue}::integer AS score, 'external'::text AS source
      FROM ${externalReviews}
      INNER JOIN ${externalReviewArticles}
        ON ${externalReviewArticles.id} = ${externalReviews.articleId}
      INNER JOIN ${externalReviewSourcePolicies}
        ON ${externalReviewSourcePolicies.externalSiteId} = ${externalReviewArticles.externalSiteId}
      WHERE ${inArray(externalReviews.bottleId, bottleIds)}
        AND ${externalWhere}
    ), score_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE source = 'member') AS "memberScoreCount",
        COUNT(*) FILTER (WHERE source = 'external') AS "externalScoreCount",
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY score) AS "medianScore",
        MIN(score) AS "minScore",
        MAX(score) AS "maxScore"
      FROM score_values
    )
    SELECT
      COUNT(${tastings.id}) AS "totalTastings",
      COUNT(${tastings.id}) FILTER (WHERE ${tastings.ratingBand} = 'mediocre') AS mediocre,
      COUNT(${tastings.id}) FILTER (WHERE ${tastings.ratingBand} = 'good') AS good,
      COUNT(${tastings.id}) FILTER (WHERE ${tastings.ratingBand} = 'very_good') AS "veryGood",
      COUNT(${tastings.id}) FILTER (WHERE ${tastings.ratingBand} = 'outstanding') AS outstanding,
      COUNT(${tastings.id}) FILTER (WHERE ${tastings.ratingBand} = 'unicorn') AS unicorn,
      score_stats.*
    FROM score_stats
    LEFT JOIN ${tastings} ON ${inArray(tastings.bottleId, bottleIds)}
    GROUP BY
      score_stats."memberScoreCount",
      score_stats."externalScoreCount",
      score_stats."medianScore",
      score_stats."minScore",
      score_stats."maxScore"
  `);
  const raw = result.rows[0];
  if (!raw) throw new BottleActivityStatsAggregationError();

  const memberScoreCount = requiredCount(raw.memberScoreCount);
  const externalScoreCount = requiredCount(raw.externalScoreCount);
  const scoreCount = memberScoreCount + externalScoreCount;

  return {
    totalTastings: requiredCount(raw.totalTastings),
    medianScore:
      scoreCount >= MIN_BOTTLE_SCORE_COUNT
        ? requiredScore(raw.medianScore)
        : null,
    minScore:
      scoreCount >= MIN_BOTTLE_SCORE_COUNT ? requiredScore(raw.minScore) : null,
    maxScore:
      scoreCount >= MIN_BOTTLE_SCORE_COUNT ? requiredScore(raw.maxScore) : null,
    memberScoreCount,
    externalScoreCount,
    tastingBandCounts: {
      ...EMPTY_TASTING_BAND_COUNTS,
      mediocre: requiredCount(raw.mediocre),
      good: requiredCount(raw.good),
      very_good: requiredCount(raw.veryGood),
      outstanding: requiredCount(raw.outstanding),
      unicorn: requiredCount(raw.unicorn),
    },
  };
}
