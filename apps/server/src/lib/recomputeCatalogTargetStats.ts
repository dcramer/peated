import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import type { AnyTransaction } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { tastings } from "@peated/server/db/schema";
import { inArray, sql } from "drizzle-orm";

export type CatalogTargetStats = Pick<
  Bottle,
  "totalTastings" | "avgRating" | "ratingStats"
>;

type RawCatalogTargetStats = {
  pass: number | string;
  sip: number | string;
  savor: number | string;
  total: number | string;
  totalTastings: number | string;
  avg: number | string | null;
};

export class CatalogTargetStatsAggregationError extends Error {
  constructor() {
    super("Unable to aggregate catalog target statistics.");
    this.name = "CatalogTargetStatsAggregationError";
  }
}

function requiredCount(value: number | string): number {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    throw new CatalogTargetStatsAggregationError();
  }
  return count;
}

function requiredAverage(value: number | string | null): number | null {
  if (value === null) return null;
  const average = Number(value);
  if (!Number.isFinite(average)) {
    throw new CatalogTargetStatsAggregationError();
  }
  return average;
}

/**
 * Aggregates raw activity once for a caller-supplied validated canonical target
 * set. Callers own all catalog graph validation before invoking this helper.
 */
export async function aggregateCatalogTargetStatsInTransaction(
  tx: AnyTransaction,
  targetIds: number[],
): Promise<CatalogTargetStats> {
  const result = await tx.execute<RawCatalogTargetStats>(sql`
    SELECT
      COUNT(*) AS "totalTastings",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.PASS}) AS "pass",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SIP}) AS "sip",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SAVOR}) AS "savor",
      COUNT(${tastings.rating}) AS "total",
      AVG(${tastings.rating}) AS "avg"
    FROM ${tastings}
    WHERE ${inArray(tastings.targetId, targetIds)}
  `);
  const raw = result.rows[0]!;

  const pass = requiredCount(raw.pass);
  const sip = requiredCount(raw.sip);
  const savor = requiredCount(raw.savor);
  const total = requiredCount(raw.total);
  const avg = requiredAverage(raw.avg);

  return {
    totalTastings: requiredCount(raw.totalTastings),
    avgRating: avg,
    ratingStats: {
      pass,
      sip,
      savor,
      total,
      avg,
      percentage:
        total > 0
          ? {
              pass: (pass / total) * 100,
              sip: (sip / total) * 100,
              savor: (savor / total) * 100,
            }
          : { pass: 0, sip: 0, savor: 0 },
    },
  };
}
