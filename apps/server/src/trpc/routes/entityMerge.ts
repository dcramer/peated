import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottles,
  bottlesToDistillers,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { generateUniqHash } from "@peated/server/lib/bottleHash";
import { logError } from "@peated/server/lib/log";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";
import { mergeBottlesInto } from "./bottleMerge";

// TODO: this should happen async
async function mergeEntitiesInto(
  toEntity: Entity,
  ...fromEntities: Entity[]
): Promise<Entity> {
  const fromEntityIds = fromEntities.map((e) => e.id);
  console.log(
    `Merging entities ${fromEntityIds.join(", ")} into ${toEntity.id}.`,
  );

  const newEntity = await db.transaction(async (tx) => {
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
        pushJob("IndexBottleSearchVectors", { bottleId: bottle.id });
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

          await mergeBottlesInto(toBottle, bottle);
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

    return toEntity;
  });

  try {
    await pushJob("OnEntityChange", { entityId: newEntity.id });
  } catch (err) {
    logError(err, {
      entity: {
        id: newEntity.id,
      },
    });
  }

  return newEntity;
}

export default modProcedure
  .input(
    z.object({
      root: z.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    if (input.root === input.other) {
      throw new TRPCError({
        message: "Cannot merge an entity into itself.",
        code: "BAD_REQUEST",
      });
    }

    const [rootEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.root));

    if (!rootEntity) {
      throw new TRPCError({
        message: "root not found.",
        code: "NOT_FOUND",
      });
    }

    const [otherEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.other));

    if (!otherEntity) {
      throw new TRPCError({
        message: "other not found.",
        code: "NOT_FOUND",
      });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromEntity =
      input.direction === "mergeInto" ? rootEntity : otherEntity;
    const toEntity = input.direction === "mergeInto" ? otherEntity : rootEntity;

    const newEntity = await mergeEntitiesInto(toEntity, fromEntity);

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
