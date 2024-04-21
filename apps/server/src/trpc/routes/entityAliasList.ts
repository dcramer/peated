import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      entity: z.number(),
    }),
  )
  .query(async function ({ input, ctx }) {
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

    const results = await db
      .select()
      .from(entityAliases)
      .where(and(eq(entityAliases.entityId, entity.id)));

    return {
      results: results.map((a) => ({
        name: a.name,
      })),
    };
  });
