import { app } from "@peated/api/app";
import { db } from "@peated/api/db";
import { reviews } from "@peated/api/db/schema";
import { findBottleId, findEntity } from "@peated/api/lib/bottleFinder";
import { honoRequest } from "@peated/api/lib/internalApiClient";
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
          const data = await honoRequest({
            path: "/v1/bottle/create",
            method: "POST",
            json: { name: review.name, brand: entity.id },
            user: systemUser,
          });

          bottleId = data.bottle.id;
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
