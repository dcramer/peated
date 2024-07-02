import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  tastings,
} from "@peated/server/db/schema";
import { notEmpty, uniq } from "@peated/server/lib/filter";
import { eq, sql } from "drizzle-orm";
import { runJob } from "./";

export default async ({ bottleId }: { bottleId: number }) => {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  await db
    .update(bottles)
    .set({
      totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
      avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
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
    runJob("UpdateEntityStats", { entityId });
  }
};
