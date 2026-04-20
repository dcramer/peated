import { db as defaultDb, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleReleases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, inArray, or, sql } from "drizzle-orm";

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
  const updatedReleaseIds = new Set<number>();
  const updatedEntityIds = new Set<number>();
  await db.transaction(async (tx) => {
    const [
      sourceBottles,
      sourceCollectionRows,
      sourceFlightRows,
      sourceDistillerRows,
      targetDistillerRows,
      existingTags,
      existingFlavorProfiles,
    ] = await Promise.all([
      tx.select().from(bottles).where(inArray(bottles.id, fromBottleIds)),
      tx
        .select()
        .from(collectionBottles)
        .where(inArray(collectionBottles.bottleId, fromBottleIds)),
      tx
        .select()
        .from(flightBottles)
        .where(inArray(flightBottles.bottleId, fromBottleIds)),
      tx
        .select()
        .from(bottlesToDistillers)
        .where(inArray(bottlesToDistillers.bottleId, fromBottleIds)),
      tx
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, toBottleId)),
      tx.query.bottleTags.findMany({
        where: inArray(bottleTags.bottleId, fromBottleIds),
      }),
      tx.query.bottleFlavorProfiles.findMany({
        where: inArray(bottleFlavorProfiles.bottleId, fromBottleIds),
      }),
    ]);

    if (sourceBottles.length !== fromBottleIds.length) {
      const existingBottleIds = new Set(
        sourceBottles.map((bottle) => bottle.id),
      );
      const missingBottleIds = fromBottleIds.filter(
        (id) => !existingBottleIds.has(id),
      );
      throw new Error(
        `Source bottle(s) not found: ${missingBottleIds.join(", ")}`,
      );
    }

    for (const entityId of [
      targetBottle.brandId,
      targetBottle.bottlerId,
      ...targetDistillerRows.map((row) => row.distillerId),
    ]) {
      if (entityId !== null) {
        updatedEntityIds.add(entityId);
      }
    }

    for (const bottle of sourceBottles) {
      for (const entityId of [bottle.brandId, bottle.bottlerId]) {
        if (entityId !== null) {
          updatedEntityIds.add(entityId);
        }
      }
    }

    for (const row of sourceDistillerRows) {
      updatedEntityIds.add(row.distillerId);
    }

    if (sourceCollectionRows.length > 0) {
      await tx
        .insert(collectionBottles)
        .values(
          sourceCollectionRows.map((row) => ({
            collectionId: row.collectionId,
            bottleId: toBottleId,
            releaseId: row.releaseId,
            createdAt: row.createdAt,
          })),
        )
        .onConflictDoNothing();
    }

    if (sourceFlightRows.length > 0) {
      await tx
        .insert(flightBottles)
        .values(
          sourceFlightRows.map((row) => ({
            flightId: row.flightId,
            bottleId: toBottleId,
            releaseId: row.releaseId,
          })),
        )
        .onConflictDoNothing();
    }

    if (sourceDistillerRows.length > 0) {
      await tx
        .insert(bottlesToDistillers)
        .values(
          sourceDistillerRows.map((row) => ({
            bottleId: toBottleId,
            distillerId: row.distillerId,
          })),
        )
        .onConflictDoNothing();
    }

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
        .update(bottleObservations)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(bottleObservations.bottleId, fromBottleIds)),

      tx
        .update(storePriceMatchProposals)
        .set({
          currentBottleId: sql`CASE
            WHEN ${inArray(storePriceMatchProposals.currentBottleId, fromBottleIds)}
              THEN ${toBottleId}
            ELSE ${storePriceMatchProposals.currentBottleId}
          END`,
          suggestedBottleId: sql`CASE
            WHEN ${inArray(storePriceMatchProposals.suggestedBottleId, fromBottleIds)}
              THEN ${toBottleId}
            ELSE ${storePriceMatchProposals.suggestedBottleId}
          END`,
          parentBottleId: sql`CASE
            WHEN ${inArray(storePriceMatchProposals.parentBottleId, fromBottleIds)}
              THEN ${toBottleId}
            ELSE ${storePriceMatchProposals.parentBottleId}
          END`,
          updatedAt: sql`NOW()`,
        })
        .where(
          or(
            inArray(storePriceMatchProposals.currentBottleId, fromBottleIds),
            inArray(storePriceMatchProposals.suggestedBottleId, fromBottleIds),
            inArray(storePriceMatchProposals.parentBottleId, fromBottleIds),
          ),
        ),

      // TODO: handle conflicts
      tx
        .update(bottleAliases)
        .set({
          bottleId: toBottleId,
        })
        .where(inArray(bottleAliases.bottleId, fromBottleIds)),
    ]);

    if (sourceCollectionRows.length > 0) {
      await tx
        .delete(collectionBottles)
        .where(inArray(collectionBottles.bottleId, fromBottleIds));
    }

    if (sourceFlightRows.length > 0) {
      await tx
        .delete(flightBottles)
        .where(inArray(flightBottles.bottleId, fromBottleIds));
    }

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
      updatedReleaseIds.add(release.id);
    }

    await Promise.all(
      fromBottleIds.map((id) =>
        tx.insert(bottleTombstones).values({
          bottleId: id,
          newBottleId: toBottleId,
        }),
      ),
    );

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
              count: sql<number>`${bottleTags.count} + ${row.count}`,
            },
          }),
      ),
    );

    await Promise.all(
      existingFlavorProfiles.map((row) =>
        tx
          .insert(bottleFlavorProfiles)
          .values({
            bottleId: toBottleId,
            flavorProfile: row.flavorProfile,
            count: row.count,
          })
          .onConflictDoUpdate({
            target: [
              bottleFlavorProfiles.bottleId,
              bottleFlavorProfiles.flavorProfile,
            ],
            set: {
              count: sql<number>`${bottleFlavorProfiles.count} + ${row.count}`,
            },
          }),
      ),
    );

    // wipe old bottles
    await Promise.all([
      tx.delete(bottleTags).where(inArray(bottleTags.bottleId, fromBottleIds)),
      tx
        .delete(bottleFlavorProfiles)
        .where(inArray(bottleFlavorProfiles.bottleId, fromBottleIds)),
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

  for (const releaseId of updatedReleaseIds) {
    try {
      await pushUniqueJob(
        "OnBottleReleaseChange",
        { releaseId },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        release: {
          id: releaseId,
        },
      });
    }
  }

  for (const entityId of updatedEntityIds) {
    try {
      await pushUniqueJob("OnEntityChange", { entityId }, { delay: 5000 });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
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
