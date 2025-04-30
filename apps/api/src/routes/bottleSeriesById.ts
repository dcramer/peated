import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { bottleSeries } from "../db/schema";
import { serialize } from "../serializers";
import { BottleSeriesSerializer } from "../serializers/bottleSeries";
import { publicProcedure } from "../trpc";

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
