import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import type { AnyTransaction } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { tastings } from "@peated/server/db/schema";
import { inArray, sql } from "drizzle-orm";

export type BottleActivityStats = Pick<
  Bottle,
  "totalTastings" | "avgRating" | "ratingStats"
>;

type RawBottleActivityStats = {
  pass: number | string;
  sip: number | string;
  savor: number | string;
  total: number | string;
  totalTastings: number | string;
  avg: number | string | null;
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

function requiredAverage(value: number | string | null): number | null {
  if (value === null) return null;
  const average = Number(value);
  if (!Number.isFinite(average)) {
    throw new BottleActivityStatsAggregationError();
  }
  return average;
}

/**
 * Aggregates raw activity once for a caller-supplied validated Bottle set.
 * Callers own Bottle and group integrity validation before invoking this helper.
 */
export async function aggregateBottleActivityStatsInTransaction(
  tx: AnyTransaction,
  bottleIds: number[],
): Promise<BottleActivityStats> {
  const result = await tx.execute<RawBottleActivityStats>(sql`
    SELECT
      COUNT(*) AS "totalTastings",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.PASS}) AS "pass",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SIP}) AS "sip",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SAVOR}) AS "savor",
      COUNT(${tastings.rating}) AS "total",
      AVG(${tastings.rating}) AS "avg"
    FROM ${tastings}
    WHERE ${inArray(tastings.bottleId, bottleIds)}
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
