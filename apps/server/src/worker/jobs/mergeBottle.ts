import { db as defaultDb, type AnyDatabase } from "@peated/server/db";
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
import { upsertBottleAlias } from "@peated/server/lib/db";
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
    `Merging bottles ${fromBottleIds.join(", ")} into ${toBottleId}.`,
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
  const updatedAliasNames = new Set<string>();
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

    for (const release of releases) {
      const newName = formatReleaseName({
        name: targetBottle.name,
        edition: release.edition,
        abv: release.abv,
        statedAge: targetBottle.statedAge ? null : release.statedAge,
        releaseYear: release.releaseYear,
        vintageYear: release.vintageYear,
        singleCask: release.singleCask,
        caskStrength: release.caskStrength,
        caskFill: release.caskFill,
        caskType: release.caskType,
        caskSize: release.caskSize,
      });

      const newFullName = formatReleaseName({
        name: targetBottle.fullName,
        edition: release.edition,
        abv: release.abv,
        statedAge: targetBottle.statedAge ? null : release.statedAge,
        releaseYear: release.releaseYear,
        vintageYear: release.vintageYear,
        singleCask: release.singleCask,
        caskStrength: release.caskStrength,
        caskFill: release.caskFill,
        caskType: release.caskType,
        caskSize: release.caskSize,
      });

      await tx
        .update(bottleReleases)
        .set({
          bottleId: toBottleId,
          name: newName,
          fullName: newFullName,
        })
        .where(eq(bottleReleases.id, release.id));

      const releaseAlias = await upsertBottleAlias(
        tx,
        newFullName,
        toBottleId,
        release.id,
      );
      if (
        releaseAlias.bottleId !== toBottleId ||
        (releaseAlias.releaseId ?? null) !== release.id
      ) {
        throw new Error("Release alias already belongs to a different bottle.");
      }

      updatedAliasNames.add(newFullName);
    }

    await Promise.all(
      fromBottleIds.map((id) =>
        tx.insert(bottleTombstones).values({
          bottleId: id,
          newBottleId: toBottleId,
        }),
      ),
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
          }),
      ),
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

  for (const aliasName of updatedAliasNames) {
    try {
      await pushUniqueJob(
        "OnBottleAliasChange",
        { name: aliasName },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        alias: {
          name: aliasName,
        },
      });
    }
  }

  try {
    await pushUniqueJob(
      "OnBottleChange",
      { bottleId: toBottleId },
      { delay: 5000 },
    );
  } catch (err) {
    logError(err, {
      bottle: {
        id: toBottleId,
      },
    });
  }
}
