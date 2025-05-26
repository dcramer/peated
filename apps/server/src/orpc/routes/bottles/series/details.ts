import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleSeriesSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/bottle-series/{series}" })
  .input(z.object({ series: z.coerce.number() }))
  .output(BottleSeriesSchema)
  .handler(async function ({ input, context, errors }) {
    const [series] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, input.series));

    if (!series) {
      throw errors.NOT_FOUND({
        message: "Series not found.",
      });
    }

    return await serialize(BottleSeriesSerializer, series, context.user);
  });
