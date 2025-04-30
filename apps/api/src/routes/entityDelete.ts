import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  changes,
  entities,
  entityAliases,
  entityTombstones,
} from "../db/schema";
import { adminProcedure } from "../trpc";

export default adminProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, input))
    .limit(1);
  if (!entity) {
    throw new TRPCError({
      message: "Entity not found.",
      code: "NOT_FOUND",
    });
  }

  await db.transaction(async (tx) => {
    await Promise.all([
      tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        createdById: ctx.user.id,
        displayName: entity.name,
        type: "delete",
        data: {
          ...entity,
        },
      }),

      tx.delete(entityAliases).where(eq(entityAliases.entityId, entity.id)),

      tx.insert(entityTombstones).values({
        entityId: entity.id,
      }),
    ]);

    await tx.delete(entities).where(eq(entities.id, entity.id));
  });

  return {};
});
