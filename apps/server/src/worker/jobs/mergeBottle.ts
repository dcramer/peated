import {
  db as defaultDb,
  type DatabaseType,
  type TransactionType,
} from "@peated/server/db";
import {
  bottleAliases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  flightBottles,
  reviews,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/client";
import { inArray, sql } from "drizzle-orm";

// TODO: this should happen async
export default async function mergeBottle({
  toBottleId,
  fromBottleIds,
  db = defaultDb,
}: {
  toBottleId: number;
  fromBottleIds: number[];
  db: DatabaseType | TransactionType;
}) {
  console.log(
    `Merging bottles ${fromBottleIds.join(", ")} into ${toBottleId}.`,
  );

  // TODO: this doesnt handle duplicate bottles
  await db.transaction(async (tx) => {
    await tx
      .update(tastings)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(tastings.bottleId, fromBottleIds));

    await tx
      .update(storePrices)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(storePrices.bottleId, fromBottleIds));

    await tx
      .update(reviews)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(reviews.bottleId, fromBottleIds));

    await tx
      .update(flightBottles)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(flightBottles.bottleId, fromBottleIds));

    await tx
      .update(collectionBottles)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(collectionBottles.bottleId, fromBottleIds));

    // TODO: handle conflicts
    await tx
      .update(bottleAliases)
      .set({
        bottleId: toBottleId,
      })
      .where(inArray(bottleAliases.bottleId, fromBottleIds));

    for (const id of fromBottleIds) {
      await tx.insert(bottleTombstones).values({
        bottleId: id,
        newBottleId: toBottleId,
      });
    }

    const existingTags = await tx.query.bottleTags.findMany({
      where: inArray(bottleTags.bottleId, fromBottleIds),
    });
    for (const row of existingTags) {
      await tx
        .insert(bottleTags)
        .values({
          bottleId: toBottleId,
          tag: row.tag,
          count: row.count,
        })
        .onConflictDoUpdate({
          target: [bottleTags.bottleId, bottleTags.tag],
          set: {
            count: sql<number>`${bottleTags.count} + 1`,
          },
        });
    }

    // wipe old bottles
    await tx
      .delete(bottleTags)
      .where(inArray(bottleTags.bottleId, fromBottleIds));
    await tx
      .delete(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, fromBottleIds));
    await tx.delete(bottles).where(inArray(bottles.id, fromBottleIds));
  });

  try {
    await pushJob("OnBottleChange", { bottleId: toBottleId });
  } catch (err) {
    logError(err, {
      bottle: {
        id: toBottleId,
      },
    });
  }
}
