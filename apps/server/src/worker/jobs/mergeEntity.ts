import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  bottlesToDistillers,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatBottleName, formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { ConflictError } from "@peated/server/orpc/errors";
import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import { eq, inArray } from "drizzle-orm";

// TODO: this should happen async
export default async function mergeEntity({
  toEntityId,
  fromEntityIds,
}: {
  toEntityId: number;
  fromEntityIds: number[];
}) {
  console.log(
    `Merging entities ${fromEntityIds.join(", ")} into ${toEntityId}.`
  );

  const [toEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, toEntityId));
  if (!toEntity) {
    console.warn(`Entity not found: ${toEntityId}`);
    return;
  }

  const updatedBottleIds: number[] = [];
  const updatedReleaseIds: number[] = [];
  await db.transaction(async (tx) => {
    const bottleList = await tx
      .select()
      .from(bottles)
      .where(inArray(bottles.brandId, fromEntityIds));

    for (const bottle of bottleList) {
      // bottles are unique on alias, so we need to attempt to bind the alias,
      // and on conflict we're going to merge
      const fullName = formatBottleName({
        ...bottle,
        name: `${toEntity.shortName || toEntity.name} ${bottle.name}`,
      });
      const alias = await upsertBottleAlias(tx, fullName, bottle.id);
      // alias.bottleId is always set, but I don't want to deal w/ TS
      if (alias.bottleId && alias.bottleId !== bottle.id) {
        const [existingBottle] = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.id, alias.bottleId));
        // the only way this can conflict is via brand
        if (existingBottle.brandId !== toEntity.id) {
          throw new ConflictError(
            existingBottle,
            undefined,
            "An error occurred while trying to merge duplicate bottles."
          );
        }
        await runJob("MergeBottle", {
          toBottleId: alias.bottleId,
          fromBottleIds: [bottle.id],
          db: tx,
        });
      } else {
        // there was no conflict so lets update it
        await tx
          .update(bottles)
          .set({ brandId: toEntity.id, fullName })
          .where(eq(bottles.id, bottle.id));

        // Update associated releases
        const releases = await tx
          .select()
          .from(bottleReleases)
          .where(eq(bottleReleases.bottleId, bottle.id));

        await Promise.all(
          releases.map(async (release) => {
            const newName = formatReleaseName({
              name: bottle.name,
              edition: release.edition,
              abv: release.abv,
              statedAge: bottle.statedAge ? null : release.statedAge,
              releaseYear: release.releaseYear,
              vintageYear: release.vintageYear,
            });

            const newFullName = formatReleaseName({
              name: fullName,
              edition: release.edition,
              abv: release.abv,
              statedAge: bottle.statedAge ? null : release.statedAge,
              releaseYear: release.releaseYear,
              vintageYear: release.vintageYear,
            });

            return tx
              .update(bottleReleases)
              .set({
                name: newName,
                fullName: newFullName,
              })
              .where(eq(bottleReleases.id, release.id));
          })
        );
        updatedReleaseIds.push(...releases.map((r) => r.id));
      }
      updatedBottleIds.push(bottle.id);
    }

    await Promise.all([
      tx
        .update(bottles)
        .set({
          bottlerId: toEntity.id,
        })
        .where(inArray(bottles.bottlerId, fromEntityIds)),

      tx
        .update(entityAliases)
        .set({
          entityId: toEntity.id,
        })
        .where(inArray(entityAliases.entityId, fromEntityIds)),

      tx
        .update(bottlesToDistillers)
        .set({
          distillerId: toEntity.id,
        })
        .where(inArray(bottlesToDistillers.distillerId, fromEntityIds)),
    ]);

    await Promise.all(
      fromEntityIds.map((id) =>
        tx.insert(entityTombstones).values({
          entityId: id,
          newEntityId: toEntity.id,
        })
      )
    );

    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));
  });

  for (const bottleId of updatedBottleIds) {
    try {
      await pushUniqueJob(
        "IndexBottleSearchVectors",
        { bottleId: bottleId },
        { delay: 5000 }
      );
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottleId,
        },
      });
    }
  }

  for (const releaseId of updatedReleaseIds) {
    try {
      await pushUniqueJob(
        "IndexBottleReleaseSearchVectors",
        { releaseId: releaseId },
        { delay: 5000 }
      );
    } catch (err) {
      logError(err, {
        release: {
          id: releaseId,
        },
      });
    }
  }

  try {
    await pushUniqueJob(
      "OnEntityChange",
      { entityId: toEntityId },
      { delay: 5000 }
    );
  } catch (err) {
    logError(err, {
      entity: {
        id: toEntityId,
      },
    });
  }
}
