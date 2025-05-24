import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { findBottleId, findEntity } from "@peated/server/lib/bottleFinder";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

export default async function createMissingBottles() {
  const systemUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.username, "dcramer"),
  });
  if (!systemUser) throw new Error("Unable to identify system user");

  let hasResults = true;
  while (hasResults) {
    const missingInReviews = await db
      .select()
      .from(reviews)
      .where(isNull(reviews.bottleId))
      .limit(100);

    if (missingInReviews.length === 0) {
      hasResults = false;
      break;
    }

    for (const review of missingInReviews) {
      let bottleId = await findBottleId(review.name);
      if (!bottleId) {
        console.log(`Creating bottle for review [${review.id}]`);

        const entity = await findEntity(review.name);
        if (entity) {
          const result = await routerClient.bottles.create(
            {
              name: review.name,
              brand: entity.id,
            },
            { context: { user: systemUser } },
          );
          bottleId = result.id;
        }
      } else {
        console.log(`Identified bottle for review [${review.id}]`);
      }

      await db
        .update(reviews)
        .set({
          bottleId,
        })
        .where(and(eq(reviews.id, review.id), isNull(reviews.bottleId)));
    }
  }
}
