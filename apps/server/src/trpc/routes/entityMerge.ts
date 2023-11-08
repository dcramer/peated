import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

// TODO: this should happen async
async function mergeEntitiesInto(
  toEntity: Entity,
  ...fromEntities: Entity[]
): Promise<Entity> {
  const fromEntityIds = fromEntities.map((e) => e.id);
  console.log(
    `Merging entities ${fromEntityIds.join(", ")} into ${toEntity.id}.`,
  );

  const totalBottles = fromEntities.reduce(
    (acc, ent) => acc + ent.totalBottles,
    0,
  );
  const totalTastings = fromEntities.reduce(
    (acc, ent) => acc + ent.totalTastings,
    0,
  );

  // TODO: this doesnt handle duplicate bottles
  return await db.transaction(async (tx) => {
    await tx
      .update(bottles)
      .set({
        brandId: toEntity.id,
      })
      .where(inArray(bottles.brandId, fromEntityIds));

    await tx
      .update(bottles)
      .set({
        bottlerId: toEntity.id,
      })
      .where(inArray(bottles.bottlerId, fromEntityIds));

    await tx
      .update(bottlesToDistillers)
      .set({
        distillerId: toEntity.id,
      })
      .where(inArray(bottlesToDistillers.distillerId, fromEntityIds));

    const [entity] = await tx
      .update(entities)
      .set({
        totalBottles: sql`${entities.totalBottles} + ${totalBottles}`,
        totalTastings: sql`${entities.totalTastings} + ${totalTastings}`,
      })
      .where(eq(entities.id, toEntity.id))
      .returning();

    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));

    return entity;
  });
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
        message: "toEntity not found.",
        code: "NOT_FOUND",
      });
    }

    const [otherEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.other));

    if (!otherEntity) {
      throw new TRPCError({
        message: "fromEntity not found.",
        code: "NOT_FOUND",
      });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromEntity =
      input.direction === "mergeInto" ? rootEntity : otherEntity;
    const toEntity = input.direction === "mergeInto" ? otherEntity : rootEntity;

    const newEntity = await mergeEntitiesInto(toEntity, fromEntity);
    await pushJob("GenerateEntityDetails", { entityId: toEntity.id });

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
