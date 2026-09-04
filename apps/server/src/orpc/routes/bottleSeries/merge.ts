import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  changes,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  getBottleSeriesMemberships,
  updateBottleSeriesReleaseCounts,
} from "@peated/server/lib/bottleSeriesReleaseCounts";
import {
  finalizeBottleUpdate,
  updateBottleInTransaction,
  type BottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSeriesSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-series/{series}/merge",
    summary: "Merge bottle series",
    description:
      "Move every bottle into another series from the same brand and preserve the retired public ID. Requires moderator privileges.",
    spec: (spec) => ({ ...spec, operationId: "mergeBottleSeries" }),
  })
  .input(
    z.object({
      series: z.coerce.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .output(BottleSeriesSchema)
  .handler(async function ({ input, context, errors }) {
    const sourceSeriesId =
      input.direction === "mergeInto" ? input.series : input.other;
    const destinationSeriesId =
      input.direction === "mergeInto" ? input.other : input.series;

    if (sourceSeriesId === destinationSeriesId) {
      throw errors.BAD_REQUEST({
        message: "A series cannot be merged into itself.",
      });
    }

    // This transaction retires the source ID only after every bottle has moved.
    const { destination, manifests } = await db.transaction(async (tx) => {
      const lockedSeries = await tx
        .select()
        .from(bottleSeries)
        .where(inArray(bottleSeries.id, [sourceSeriesId, destinationSeriesId]))
        .orderBy(asc(bottleSeries.id))
        .for("update");
      const source = lockedSeries.find(({ id }) => id === sourceSeriesId);
      const destination = lockedSeries.find(
        ({ id }) => id === destinationSeriesId,
      );

      if (!source || !destination) {
        throw errors.NOT_FOUND({ message: "Series not found." });
      }
      if (source.brandId !== destination.brandId) {
        throw errors.CONFLICT({
          message: "Only series from the same brand can be merged.",
        });
      }

      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const groups = await tx
        .select({
          id: bottleGroups.id,
          representativeBottleId: bottleGroups.representativeBottleId,
        })
        .from(bottleGroups)
        .where(eq(bottleGroups.seriesId, source.id))
        .orderBy(asc(bottleGroups.id));
      const manifests: BottleUpdateFinalizationManifest[] = [];

      for (const group of groups) {
        if (group.representativeBottleId === null) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} is incomplete and cannot be moved.`,
          });
        }
        manifests.push(
          await updateBottleInTransaction(tx, {
            bottleId: group.representativeBottleId,
            input: { series: destination.id },
            actorId,
            creationSource: "manual_entry",
          }),
        );
      }

      const ungroupedBottleIds = (
        await tx
          .select({ id: bottles.id })
          .from(bottles)
          .where(and(eq(bottles.seriesId, source.id), isNull(bottles.groupId)))
      ).map(({ id }) => id);
      const membershipsBefore = await getBottleSeriesMemberships(
        tx,
        ungroupedBottleIds,
      );

      await tx
        .update(bottles)
        .set({ seriesId: destination.id, updatedAt: new Date() })
        .where(and(eq(bottles.seriesId, source.id), isNull(bottles.groupId)));
      const membershipsAfter = await getBottleSeriesMemberships(
        tx,
        ungroupedBottleIds,
      );
      await updateBottleSeriesReleaseCounts(
        tx,
        membershipsBefore,
        membershipsAfter,
      );

      await tx
        .update(bottleSeries)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(bottleSeries.id, destination.id));

      await tx
        .update(bottleSeriesTombstones)
        .set({ newSeriesId: destination.id })
        .where(eq(bottleSeriesTombstones.newSeriesId, source.id));
      await tx
        .insert(bottleSeriesTombstones)
        .values({ seriesId: source.id, newSeriesId: destination.id })
        .onConflictDoUpdate({
          target: bottleSeriesTombstones.seriesId,
          set: { newSeriesId: destination.id },
        });

      await tx.insert(changes).values({
        objectType: "bottle_series",
        objectId: source.id,
        actorId,
        displayName: source.fullName,
        type: "delete",
        data: { ...source, destinationSeriesId: destination.id },
      });
      await tx.delete(bottleSeries).where(eq(bottleSeries.id, source.id));

      const [updatedDestination] = await tx
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.id, destination.id));

      return { destination: updatedDestination, manifests };
    });

    for (const manifest of manifests) {
      await finalizeBottleUpdate({
        ...manifest,
        affectedSeriesIds: manifest.affectedSeriesIds.filter(
          (seriesId) => seriesId !== sourceSeriesId,
        ),
      });
    }

    return await serialize(BottleSeriesSerializer, destination, context.user);
  });
