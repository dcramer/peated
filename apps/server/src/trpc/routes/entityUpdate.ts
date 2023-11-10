import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import { changes, entities } from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { arraysEqual } from "@peated/server/lib/equals";
import { EntityInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure
  .input(
    EntityInputSchema.partial().extend({
      entity: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw new TRPCError({
        message: "Entity not found.",
        code: "NOT_FOUND",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== entity.name) {
      data.name = input.name;
    }
    if (input.country !== undefined && input.country !== entity.country) {
      data.country = input.country;
    }
    if (input.region !== undefined && input.region !== entity.region) {
      data.region = input.region;
    }
    if (input.type !== undefined && !arraysEqual(input.type, entity.type)) {
      data.type = input.type;
    }
    if (
      input.yearEstablished !== undefined &&
      input.yearEstablished !== entity.yearEstablished
    ) {
      data.yearEstablished = input.yearEstablished;
    }
    if (input.website !== undefined && input.website !== entity.website) {
      data.website = input.website;
    }
    if (Object.values(data).length === 0) {
      return entity;
    }

    const user = ctx.user;
    const newEntity = await db.transaction(async (tx) => {
      let newEntity: Entity | undefined;
      try {
        [newEntity] = await tx
          .update(entities)
          .set(data)
          .where(eq(entities.id, entity.id))
          .returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "entity_name_unq") {
          throw new TRPCError({
            message: "Entity with name already exists.",
            code: "CONFLICT",
          });
        }
        throw err;
      }
      if (!newEntity) return;

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: newEntity.id,
        displayName: newEntity.name,
        createdById: user.id,
        type: "update",
        data: {
          ...data,
        },
      });

      return newEntity;
    });

    if (!newEntity) {
      throw new TRPCError({
        message: "Failed to update entity.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    if (newEntity.name !== entity.name || !newEntity.description)
      await pushJob("GenerateEntityDetails", { entityId: entity.id });

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
