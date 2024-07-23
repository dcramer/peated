import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { generateUniqHash } from "@peated/server/lib/bottleHash";
import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { runJob } from "./utils";

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
      try {
        await tx.transaction(async (btx) => {
          await btx
            .update(bottles)
            .set({
              brandId: toEntity.id,
              fullName: `${toEntity.name} ${bottle.name}`,
              uniqHash: generateUniqHash({
                ...bottle,
                fullName: `${toEntity.name} ${bottle.name}`,
              }),
            })
            .where(eq(bottles.id, bottle.id));
        });
        updatedBottleIds.push(bottle.id);
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "bottle_uniq_hash") {
          // merge the bottle with its duplicate
          const [toBottle] = await tx
            .select()
            .from(bottles)
            .where(
              and(
                eq(bottles.name, bottle.name),
                eq(bottles.brandId, toEntity.id),
                ...[
                  bottle.vintageYear
                    ? eq(bottles.vintageYear, bottle.vintageYear)
                    : isNull(bottles.vintageYear),
                ],
              ),
            );
          if (!toBottle) {
            throw new TRPCError({
              code: "NOT_IMPLEMENTED",
              message:
                "An error occurred while trying to merge duplicate bottles.",
              cause: err,
            });
          }

          await runJob("MergeBottle", {
            toBottleId: toBottle.id,
            fromBottleIds: [bottle.id],
            db: tx,
          });
        } else {
          throw err;
        }
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
      await pushJob("IndexBottleSearchVectors", { bottleId: bottleId });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottleId,
        },
      });
    }
  }

  try {
    await pushJob("OnEntityChange", { entityId: toEntityId });
  } catch (err) {
    logError(err, {
      entity: {
        id: toEntityId,
      },
    });
  }
}
