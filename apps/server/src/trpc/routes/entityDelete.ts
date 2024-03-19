import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";
import { db } from "../../db";
import { changes, entities } from "../../db/schema";

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
    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      createdById: ctx.user.id,
      displayName: entity.name,
      type: "delete",
      data: {
        ...entity,
      },
    });

    await tx.delete(entities).where(eq(entities.id, entity.id));
  });

  return {};
});
