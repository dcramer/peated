import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z.object({
      tasting: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting))
      .limit(1);
    if (!tasting) {
      throw new TRPCError({
        message: "Tasting not found.",
        code: "NOT_FOUND",
      });
    }

    if (tasting.createdById !== ctx.user.id && !ctx.user.admin) {
      throw new TRPCError({
        message: "Cannot delete another user's tasting image.",
        code: "FORBIDDEN",
      });
    }

    await db
      .update(tastings)
      .set({
        imageUrl: null,
      })
      .where(eq(tastings.id, tasting.id));

    return {
      imageUrl: null,
    };
  });
