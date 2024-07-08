import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure
  .input(
    z.object({
      entity: z.number(),
      name: z.string(),
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

    const [entityAlias] = await db
      .select()
      .from(entityAliases)
      .where(
        and(
          eq(entityAliases.entityId, input.entity),
          eq(entityAliases.name, input.name),
        ),
      );

    if (!entityAlias) {
      throw new TRPCError({
        message: "Entity Alias not found.",
        code: "NOT_FOUND",
      });
    }

    if (entityAlias.name === entity.name)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete canonical name",
      });

    await db
      .delete(entityAliases)
      .where(
        and(
          eq(entityAliases.entityId, input.entity),
          eq(entityAliases.name, input.name),
        ),
      );

    return {};
  });
