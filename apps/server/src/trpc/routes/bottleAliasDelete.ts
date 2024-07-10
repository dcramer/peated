import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure
  .input(
    z.object({
      bottle: z.number(),
      name: z.string(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
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

    const [bottleAlias] = await db
      .select({
        name: bottleAliases.name,
      })
      .from(bottleAliases)
      .where(
        and(
          eq(bottleAliases.bottleId, input.bottle),
          eq(bottleAliases.name, input.name),
        ),
      );

    if (!bottleAlias) {
      throw new TRPCError({
        message: "Bottle Alias not found.",
        code: "NOT_FOUND",
      });
    }

    const canonicalName = `${bottle.fullName}${bottle.vintageYear ? ` (${bottle.vintageYear})` : ""}`;
    if (bottleAlias.name === canonicalName)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete canonical name",
      });

    await db
      .delete(bottleAliases)
      .where(
        and(
          eq(bottleAliases.bottleId, input.bottle),
          eq(bottleAliases.name, input.name),
        ),
      );

    return {};
  });
