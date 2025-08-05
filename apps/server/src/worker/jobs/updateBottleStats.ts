import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  tastings,
} from "@peated/server/db/schema";
import { notEmpty, uniq } from "@peated/server/lib/filter";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";

export default async ({ bottleId }: { bottleId: number }) => {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  // Calculate rating stats
  const ratingStatsQuery = sql`
    SELECT 
      COUNT(*) FILTER (WHERE rating = -1) as pass,
      COUNT(*) FILTER (WHERE rating = 1) as sip,
      COUNT(*) FILTER (WHERE rating = 2) as savor,
      COUNT(*) FILTER (WHERE rating IS NOT NULL) as total,
      AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg
    FROM ${tastings}
    WHERE ${tastings.bottleId} = ${bottle.id}
  `;

  const result = await db.execute<{
    pass: number;
    sip: number;
    savor: number;
    total: number;
    avg: number | null;
  }>(ratingStatsQuery);
  const stats = result.rows[0];

  const ratingStats = {
    pass: Number(stats.pass) || 0,
    sip: Number(stats.sip) || 0,
    savor: Number(stats.savor) || 0,
    total: Number(stats.total) || 0,
    avg: stats.avg ? Number(stats.avg) : null,
    percentage: {
      pass: 0,
      sip: 0,
      savor: 0,
    },
  };

  if (ratingStats.total > 0) {
    ratingStats.percentage = {
      pass: (ratingStats.pass / ratingStats.total) * 100,
      sip: (ratingStats.sip / ratingStats.total) * 100,
      savor: (ratingStats.savor / ratingStats.total) * 100,
    };
  }

  await db
    .update(bottles)
    .set({
      totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
      avgRating: sql`(SELECT AVG(${tastings.ratingLegacy}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
      ratingStats,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bottles.id, bottle.id));

  const distillerIds = (
    await db
      .select({ distillerId: bottlesToDistillers.distillerId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id))
  ).map((d) => d.distillerId);

  const allEntityIds = uniq(
    [...distillerIds, bottle.brandId, bottle.bottlerId].filter(notEmpty),
  );

  for (const entityId of allEntityIds) {
    await pushUniqueJob("UpdateEntityStats", { entityId }, { delay: 5000 });
  }
};
