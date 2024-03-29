import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
    }),
  )
  .query(async function ({ input, ctx }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    const results = await db
      .select()
      .from(bottleAliases)
      .where(and(eq(bottleAliases.bottleId, bottle.id)));

    return {
      results: results.map((a) => ({
        name: a.name,
      })),
    };
  });
