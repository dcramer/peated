import { type AnyDatabase, db as defaultDb } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
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
import { formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, inArray, sql } from "drizzle-orm";

// TODO: this should happen async
export default async function mergeBottle({
  toBottleId,
  fromBottleIds,
  db = defaultDb,
}: {
  toBottleId: number;
  fromBottleIds: number[];
  db?: AnyDatabase;
}) {
  console.log(
    `Merging bottles ${fromBottleIds.join(", ")} into ${toBottleId}.`
  );

  // Get the target bottle to get its name for release updates
  const [targetBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, toBottleId));

  if (!targetBottle) {
    throw new Error(`Target bottle ${toBottleId} not found`);
  }

  // TODO: this doesnt handle duplicate bottles
  await db.transaction(async (tx) => {
    await Promise.all([
      tx
        .update(tastings)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(tastings.bottleId, fromBottleIds)),

      tx
        .update(storePrices)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(storePrices.bottleId, fromBottleIds)),

      tx
        .update(reviews)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(reviews.bottleId, fromBottleIds)),

      tx
        .update(flightBottles)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(flightBottles.bottleId, fromBottleIds)),

      tx
        .update(collectionBottles)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(collectionBottles.bottleId, fromBottleIds)),

      // TODO: handle conflicts
      tx
        .update(bottleAliases)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(bottleAliases.bottleId, fromBottleIds)),
    ]);

    // Update bottle releases with new fullName
    const releases = await tx.query.bottleReleases.findMany({
      where: inArray(bottleReleases.bottleId, fromBottleIds),
    });

    await Promise.all(
      releases.map(async (release) => {
        const newName = formatReleaseName({
          name: targetBottle.name,
          edition: release.edition,
          abv: release.abv,
          statedAge: release.statedAge,
          releaseYear: release.releaseYear,
          vintageYear: release.vintageYear,
        });

        const newFullName = formatReleaseName({
          name: targetBottle.fullName,
          edition: release.edition,
          abv: release.abv,
          statedAge: release.statedAge,
          releaseYear: release.releaseYear,
          vintageYear: release.vintageYear,
        });

        return tx
          .update(bottleReleases)
          .set({
            bottleId: toBottleId,
            name: newName,
            fullName: newFullName,
          })
          .where(eq(bottleReleases.id, release.id));
      })
    );

    await Promise.all(
      fromBottleIds.map((id) =>
        tx.insert(bottleTombstones).values({
          bottleId: id,
          newBottleId: toBottleId,
        })
      )
    );

    const existingTags = await tx.query.bottleTags.findMany({
      where: inArray(bottleTags.bottleId, fromBottleIds),
    });

    await Promise.all(
      existingTags.map((row) =>
        tx
          .insert(bottleTags)
          .values({
            bottleId: toBottleId,
            tag: row.tag,
            count: row.count,
          })
          .onConflictDoUpdate({
            target: [bottleTags.bottleId, bottleTags.tag],
            set: {
              count: sql<string>`${bottleTags.count} + 1`,
            },
          })
      )
    );

    // wipe old bottles
    await Promise.all([
      tx.delete(bottleTags).where(inArray(bottleTags.bottleId, fromBottleIds)),
      tx
        .delete(bottlesToDistillers)
        .where(inArray(bottlesToDistillers.bottleId, fromBottleIds)),
    ]);

    await tx.delete(bottles).where(inArray(bottles.id, fromBottleIds));
  });

  try {
    await pushUniqueJob(
      "OnBottleChange",
      { bottleId: toBottleId },
      { delay: 5000 }
    );
  } catch (err) {
    logError(err, {
      bottle: {
        id: toBottleId,
      },
    });
  }
}
