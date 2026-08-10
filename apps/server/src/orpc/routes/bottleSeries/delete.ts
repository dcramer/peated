import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  changes,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  finalizeBottleUpdate,
  updateBottleInTransaction,
  type BottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/bottle-series/{series}",
    summary: "Delete bottle series",
    description:
      "Delete a bottle series and remove its reference from associated bottles. Requires moderator privileges",
    operationId: "deleteBottleSeries",
  })
  .input(z.object({ series: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const manifests = await db.transaction(async (tx) => {
      const [series] = await tx
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.id, input.series))
        .limit(1);
      if (!series) {
        throw errors.NOT_FOUND({
          message: "Series not found.",
        });
      }

      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const groups = await tx
        .select({
          id: bottleGroups.id,
          representativeBottleId: bottleGroups.representativeBottleId,
        })
        .from(bottleGroups)
        .where(eq(bottleGroups.seriesId, series.id))
        .orderBy(asc(bottleGroups.id))
        .for("update");
      const manifests: BottleUpdateFinalizationManifest[] = [];

      for (const group of groups) {
        if (group.representativeBottleId === null) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} has no representative Bottle.`,
          });
        }
        manifests.push(
          await updateBottleInTransaction(tx, {
            bottleId: group.representativeBottleId,
            input: { series: null },
            user: context.user,
            actorId,
            creationSource: "manual_entry",
          }),
        );
      }

      await tx
        .update(bottles)
        .set({ seriesId: null })
        .where(and(eq(bottles.seriesId, series.id), isNull(bottles.groupId)));

      await tx.insert(changes).values({
        objectType: "bottle_series",
        objectId: series.id,
        actorId,
        displayName: series.name,
        type: "delete",
        data: series,
      });

      await tx.delete(bottleSeries).where(eq(bottleSeries.id, series.id));

      return manifests;
    });

    for (const manifest of manifests) {
      // The deleted series has no search vector to rebuild.
      await finalizeBottleUpdate({
        ...manifest,
        affectedSeriesIds: manifest.affectedSeriesIds.filter(
          (seriesId) => seriesId !== input.series,
        ),
      });
    }

    return {};
  });
