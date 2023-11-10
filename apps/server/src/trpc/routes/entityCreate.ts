import { db } from "@peated/server/db";
import type { NewEntity } from "@peated/server/db/schema";
import { changes, entities } from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { EntityInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { authedProcedure } from "..";

export default authedProcedure
  .input(EntityInputSchema)
  .mutation(async function ({ input, ctx }) {
    const data: NewEntity = {
      ...input,
      type: input.type || [],
      createdById: ctx.user.id,
    };

    const user = ctx.user;
    const entity = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values(data)
        .onConflictDoNothing()
        .returning();

      if (!entity) {
        // see if we can update an existing entity to add a type
        const [existing] = await tx
          .select()
          .from(entities)
          .where(eq(entities.name, data.name));
        const missingTypes = data.type.filter(
          (x) => existing.type.indexOf(x) === -1,
        );
        if (missingTypes) {
          const [updated] = await tx
            .update(entities)
            .set({
              type: [...existing.type, ...missingTypes],
            })
            .where(eq(entities.name, data.name))
            .returning();
          return updated;
        }
        return null;
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        type: "add",
        createdAt: entity.createdAt,
        createdById: user.id,
        data: data,
      });

      return entity;
    });

    if (!entity) {
      throw new TRPCError({
        message: "Failed to create entity.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    await pushJob("GenerateEntityDetails", { entityId: entity.id });

    return await serialize(EntitySerializer, entity, ctx.user);
  });
