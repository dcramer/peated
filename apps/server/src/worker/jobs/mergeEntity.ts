import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { generateUniqHash } from "@peated/server/lib/bottleHash";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { ConflictError } from "@peated/server/trpc/errors";
import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

// TODO: this should happen async
export default async function mergeEntity({
  toEntityId,
  fromEntityIds,
}: {
  toEntityId: number;
  fromEntityIds: number[];
}) {
  console.log(
    `Merging entities ${fromEntityIds.join(", ")} into ${toEntityId}.`,
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

  await db.transaction(async (tx) => {
    const bottleList = await tx
      .select()
      .from(bottles)
      .where(inArray(bottles.brandId, fromEntityIds));

    for (const bottle of bottleList) {
      // bottles are unique on alias, so we need to attempt to bind the alias,
      // and on conflict we're going to merge
      const aliasName = formatBottleName({
        ...bottle,
        fullName: `${toEntity.shortName || toEntity.name} ${bottle.name}`,
      });
      const alias = await upsertBottleAlias(tx, aliasName, bottle.id);
      // alias.bottleId is always set, but I don't want to deal w/ TS
      if (alias.bottleId && alias.bottleId !== bottle.id) {
        const [existingBottle] = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.id, alias.bottleId));
        // the only way this can conflict is via brand
        if (existingBottle.brandId != toEntity.id) {
          throw new ConflictError(
            existingBottle,
            undefined,
            "An error occurred while trying to merge duplicate bottles.",
          );
        }
        await runJob("MergeBottle", {
          toBottleId: alias.bottleId,
          fromBottleIds: [bottle.id],
          db: tx,
        });
      }
    }

    await tx
      .update(bottles)
      .set({
        bottlerId: toEntity.id,
      })
      .where(inArray(bottles.bottlerId, fromEntityIds));

    await tx
      .update(entityAliases)
      .set({
        entityId: toEntity.id,
      })
      .where(inArray(entityAliases.entityId, fromEntityIds));

    await tx
      .update(bottlesToDistillers)
      .set({
        distillerId: toEntity.id,
      })
      .where(inArray(bottlesToDistillers.distillerId, fromEntityIds));

    for (const id of fromEntityIds) {
      await tx.insert(entityTombstones).values({
        entityId: id,
        newEntityId: toEntity.id,
      });
    }

    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));
  });

  for (const bottleId of updatedBottleIds) {
    try {
      await pushUniqueJob(
        "IndexBottleSearchVectors",
        { bottleId: bottleId },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottleId,
        },
      });
    }
  }

  try {
    await pushUniqueJob(
      "OnEntityChange",
      { entityId: toEntityId },
      { delay: 5000 },
    );
  } catch (err) {
    logError(err, {
      entity: {
        id: toEntityId,
      },
    });
  }
}
