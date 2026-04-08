import { db } from "@peated/server/db";
import { reviews, storePrices } from "@peated/server/db/schema";
import { runJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";

export default async ({ name }: { name: string }) => {
  // sync any new matches
  const alias = await db.query.bottleAliases.findFirst({
    where: (bottleAliases, { eq }) =>
      eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });
  if (!alias) {
    throw new Error(`Unknown bottle alias: ${name}`);
  }

  if (alias.bottleId) {
    const storePriceUpdate = alias.releaseId
      ? db
          .update(storePrices)
          .set({
            bottleId: alias.bottleId,
            releaseId: alias.releaseId,
          })
          .where(eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase()))
      : db
          .update(storePrices)
          .set({
            bottleId: alias.bottleId,
          })
          .where(eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase()));

    const reviewUpdate = alias.releaseId
      ? db
          .update(reviews)
          .set({
            bottleId: alias.bottleId,
            releaseId: alias.releaseId,
          })
          .where(eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase()))
      : db
          .update(reviews)
          .set({
            bottleId: alias.bottleId,
          })
          .where(eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase()));

    await Promise.all([storePriceUpdate, reviewUpdate]);
  }

  await runJob("IndexBottleAlias", { name });
};
