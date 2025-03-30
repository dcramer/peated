import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { db } from "../../db";
import { bottleSeries } from "../../db/schema";
import { serialize } from "../../serializers";
import { BottleSeriesSerializer } from "../../serializers/bottleSeries";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  const series = await db.query.bottleSeries.findFirst({
    where: eq(bottleSeries.id, input),
  });

  if (!series) {
    throw new TRPCError({
      message: "Series not found.",
      code: "NOT_FOUND",
    });
  }

  return await serialize(BottleSeriesSerializer, series, ctx.user);
});
