import { db } from "@peated/server/db";
import {
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
} from "@peated/server/db/schema";
import { getBottleFlavorProfile } from "@peated/server/lib/bottleFlavorProfile";
import { procedure } from "@peated/server/orpc";
import { FlavorProfileSchema } from "@peated/server/schemas/flavorProfile";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-series/{series}/flavor-profile",
    summary: "Get a bottle series flavor profile",
    description:
      "Count active bottles in a series with each family of public tasting notes. Each bottle counts once per family. Coverage includes only bottles with recognized tasting tags.",
    operationId: "getBottleSeriesFlavorProfile",
  })
  .input(z.object({ series: z.coerce.number().int().positive() }))
  .output(FlavorProfileSchema)
  .handler(async ({ input, errors }) => {
    let [series] = await db
      .select({ id: bottleSeries.id })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, input.series))
      .limit(1);

    if (!series) {
      [series] = await db
        .select({ id: bottleSeries.id })
        .from(bottleSeriesTombstones)
        .innerJoin(
          bottleSeries,
          eq(bottleSeriesTombstones.newSeriesId, bottleSeries.id),
        )
        .where(eq(bottleSeriesTombstones.seriesId, input.series))
        .limit(1);
    }

    if (!series) throw errors.NOT_FOUND({ message: "Series not found." });
    return getBottleFlavorProfile(eq(bottles.seriesId, series.id));
  });
