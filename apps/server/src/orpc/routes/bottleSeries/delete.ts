import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  changes,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/bottle-series/{series}",
    summary: "Delete bottle series",
    description:
      "Delete an empty bottle series and preserve its public ID. Requires moderator privileges.",
    spec: (spec) => ({ ...spec, operationId: "deleteBottleSeries" }),
  })
  .input(z.object({ series: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    await db.transaction(async (tx) => {
      const [series] = await tx
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.id, input.series))
        .for("update")
        .limit(1);
      if (!series) {
        throw errors.NOT_FOUND({
          message: "Series not found.",
        });
      }

      const [member] = await tx
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.seriesId, series.id))
        .limit(1);
      const [group] = await tx
        .select({ id: bottleGroups.id })
        .from(bottleGroups)
        .where(eq(bottleGroups.seriesId, series.id))
        .limit(1);
      if (member || group) {
        throw errors.CONFLICT({
          message: "This series still contains bottles. Merge it instead.",
        });
      }

      const actorId = (await getUserActorForDatabase(tx, context.user)).id;

      await tx
        .update(bottleSeriesTombstones)
        .set({ newSeriesId: null })
        .where(eq(bottleSeriesTombstones.newSeriesId, series.id));

      await tx
        .insert(bottleSeriesTombstones)
        .values({ seriesId: series.id })
        .onConflictDoUpdate({
          target: bottleSeriesTombstones.seriesId,
          set: { newSeriesId: null },
        });

      await tx.insert(changes).values({
        objectType: "bottle_series",
        objectId: series.id,
        actorId,
        displayName: series.name,
        type: "delete",
        data: series,
      });

      await tx.delete(bottleSeries).where(eq(bottleSeries.id, series.id));
    });

    return {};
  });
