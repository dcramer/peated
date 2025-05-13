import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/bottle-series/:id" })
  .input(
    z.object({
      id: z.coerce.number(),
    }),
  )
  .output(z.any())
  .handler(async function ({ input, context }) {
    const series = await db.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, input.id),
    });

    if (!series) {
      throw new ORPCError("NOT_FOUND", {
        message: "Series not found.",
      });
    }

    return await serialize(BottleSeriesSerializer, series, context.user);
  });
