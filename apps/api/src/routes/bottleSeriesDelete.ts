import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { bottles, bottleSeries, changes } from "../db/schema";
import { modProcedure } from "../trpc";

export default modProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [series] = await db
    .select()
    .from(bottleSeries)
    .where(eq(bottleSeries.id, input))
    .limit(1);
  if (!series) {
    throw new TRPCError({
      message: "Series not found.",
      code: "NOT_FOUND",
    });
  }

  await db.transaction(async (tx) => {
    await Promise.all([
      // Log the deletion in changes table
      tx.insert(changes).values({
        objectType: "bottle_series",
        objectId: series.id,
        createdById: ctx.user.id,
        displayName: series.name,
        type: "delete",
        data: series,
      }),

      // Update bottles to remove series reference
      tx
        .update(bottles)
        .set({ seriesId: null })
        .where(eq(bottles.seriesId, series.id)),
    ]);

    // Delete the series
    await tx.delete(bottleSeries).where(eq(bottleSeries.id, series.id));
  });

  return {};
});
