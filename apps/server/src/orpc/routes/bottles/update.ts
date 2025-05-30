import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import {
  coerceToUpsert,
  upsertBottleAlias,
  upsertEntity,
} from "@peated/server/lib/db";
import { formatBottleName, formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import { BottleInputSchema, BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { type BottlePreviewResult } from "@peated/server/types";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { bottleNormalize } from "./validation";

const InputSchema = BottleInputSchema.partial().extend({
  bottle: z.coerce.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottles/{bottle}",
    summary: "Update bottle",
    description:
      "Update bottle information including name, brand, distillers, and other metadata. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const bottle = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, input.bottle),
      with: {
        brand: true,
        bottler: true,
        bottlesToDistillers: {
          with: {
            distiller: true,
          },
        },
      },
    });
    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const bottleData: BottlePreviewResult & Record<string, any> =
      await bottleNormalize({
        input: BottleInputSchema.parse({
          name: bottle.name,
          brand: {
            id: bottle.brand.id,
            name: bottle.brand.name,
          },
          bottler: bottle.bottler
            ? {
                id: bottle.bottler.id,
                name: bottle.bottler.name,
              }
            : null,
          statedAge: bottle.statedAge,
          caskStrength: bottle.caskStrength,
          singleCask: bottle.singleCask,
          category: bottle.category,
          distillers: bottle.bottlesToDistillers.map((d) => ({
            id: d.distiller.id,
            name: d.distiller.name,
          })),
          vintageYear: bottle.vintageYear,
          releaseYear: bottle.releaseYear,
          ...input,
        }),
        context,
      });

    if (
      input.description !== undefined &&
      input.description !== bottle.description
    ) {
      bottleData.description = input.description;
      bottleData.descriptionSrc =
        input.descriptionSrc ||
        (input.description && input.description !== null ? "user" : null);
    }

    if (
      input.image === null &&
      (user?.admin || user?.mod || user?.id === bottle.createdById)
    ) {
      bottleData.imageUrl = null;
    }

    const newAliases: string[] = [];
    const newEntityIds: Set<number> = new Set();

    let seriesCreated = false;

    const newBottle = await db.transaction(async (tx) => {
      let brand: Entity | null = null;
      if (bottleData.brand) {
        if (
          typeof bottleData.brand === "number"
            ? bottleData.brand !== bottle.brand.id
            : bottleData.brand.name !== bottle.brand.name
        ) {
          const brandUpsert = await upsertEntity({
            db: tx,
            data: coerceToUpsert(bottleData.brand),
            userId: user.id,
            type: "brand",
          });
          if (!brandUpsert)
            throw errors.INTERNAL_SERVER_ERROR({
              message: `Unable to find entity: ${bottleData.brand}.`,
            });
          if (brandUpsert.id !== bottle.brandId) {
            bottleData.brandId = brandUpsert.id;
          }
          brand = brandUpsert.result;
          if (brandUpsert.created) newEntityIds.add(brandUpsert.id);
        }
      }

      // Handle series creation if needed
      let seriesId: number | null = null;

      if (input.series) {
        // Get the brand to build fullName if not already set
        if (!brand) {
          brand =
            (await tx.query.entities.findFirst({
              where: eq(entities.id, bottle.brandId),
            })) || null;
          if (!brand) throw new Error("Unexpected");
        }

        [seriesId, seriesCreated] = await processSeries({
          series: input.series,
          brand,
          userId: user.id,
          tx,
        });

        if (!seriesCreated && seriesId) {
          await tx
            .update(bottleSeries)
            .set({
              numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId}) + 1`,
            })
            .where(eq(bottleSeries.id, seriesId));
        }
      }

      if (bottleData.bottler) {
        if (
          typeof bottleData.bottler === "number"
            ? bottleData.bottler !== bottle.bottler?.id
            : bottleData.bottler.name !== bottle.bottler?.name
        ) {
          const bottlerUpsert = await upsertEntity({
            db: tx,
            data: coerceToUpsert(bottleData.bottler),
            userId: user.id,
            type: "bottler",
          });
          if (!bottlerUpsert) {
            throw errors.INTERNAL_SERVER_ERROR({
              message: `Unable to find entity: ${bottleData.bottler}.`,
            });
          }
          if (bottlerUpsert.id !== bottle.bottlerId) {
            bottleData.bottlerId = bottlerUpsert.id;
          }
          if (bottlerUpsert.created) newEntityIds.add(bottlerUpsert.id);
        }
      }

      // these are the final values
      const distillerIds: number[] = [];
      const distillerList: Entity[] = [];

      const newDistillerIds: number[] = [];
      const removedDistillerIds: number[] = [];
      const currentDistillers = bottle.bottlesToDistillers.map(
        (d) => d.distiller,
      );

      // find newly added distillers and connect them
      if (bottleData.distillers) {
        for (const distData of bottleData.distillers) {
          const distiller = currentDistillers.find((d2) =>
            typeof distData === "number"
              ? distData === d2.id
              : distData.name === d2.name,
          );

          if (!distiller) {
            const distUpsert = await upsertEntity({
              db: tx,
              data: coerceToUpsert(distData),
              userId: user.id,
              type: "distiller",
            });
            if (!distUpsert) {
              throw errors.INTERNAL_SERVER_ERROR({
                message: `Unable to find entity: ${distData}.`,
              });
            }
            if (distUpsert.created) newEntityIds.add(distUpsert.id);

            await tx.insert(bottlesToDistillers).values({
              bottleId: bottle.id,
              distillerId: distUpsert.id,
            });

            distillerIds.push(distUpsert.id);
            newDistillerIds.push(distUpsert.id);
            distillerList.push(distUpsert.result);
          } else {
            distillerIds.push(distiller.id);
            distillerList.push(distiller);
          }
        }

        // find existing distillers which should no longer exist and remove them
        const removedDistillers = currentDistillers.filter(
          (d) => !distillerIds.includes(d.id),
        );
        for (const distiller of removedDistillers) {
          removedDistillerIds.push(distiller.id);
          await tx
            .delete(bottlesToDistillers)
            .where(
              and(
                eq(bottlesToDistillers.distillerId, distiller.id),
                eq(bottlesToDistillers.bottleId, bottle.id),
              ),
            );
        }
      }

      if (bottleData.name || bottleData.brandId) {
        if (!brand) {
          brand =
            (await tx.query.entities.findFirst({
              where: eq(entities.id, bottle.brandId),
            })) || null;
          if (!brand) throw new Error("Unexpected");
        }
        bottleData.fullName = formatBottleName({
          ...bottle,
          ...bottleData,
          name: `${brand.shortName || brand.name} ${bottleData.name ?? bottle.name}`,
        });

        // Update all associated bottle releases with the new name
        const releases = await tx.query.bottleReleases.findMany({
          where: eq(bottleReleases.bottleId, bottle.id),
        });

        for (const release of releases) {
          const newName = formatReleaseName({
            name: bottleData.name ?? bottle.name,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
          });

          const newFullName = formatReleaseName({
            name: bottleData.fullName,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
          });

          await tx
            .update(bottleReleases)
            .set({
              name: newName,
              fullName: newFullName,
            })
            .where(eq(bottleReleases.id, release.id));
        }
      }

      // bottles ae unique on aliases, so if an alias exists that is bound to
      // another bottle, that means this bottle already exists
      //
      // 1. look for an existing hash
      // 2. if it doesnt exist, or it doesnt have a bottleId, we can create this bottle
      // 3. finally persist the bottleId to the new hash
      //
      // in all of these scenarios we need to run constraint checks

      let alias;
      if (bottleData.fullName) {
        alias = await upsertBottleAlias(tx, bottleData.fullName, bottle.id);
        // alias.bottleId is always set, but I don't want to deal w/ TS
        if (alias.bottleId && alias.bottleId !== bottle.id) {
          const [existingBottle] = await tx
            .select()
            .from(bottles)
            .where(eq(bottles.id, alias.bottleId));
          throw new ConflictError(existingBottle);
        }
      }

      const newBottle = Object.values(bottleData).length
        ? (
            await tx
              .update(bottles)
              .set({
                ...bottleData,
                seriesId,
                updatedAt: sql`NOW()`,
              })
              .where(eq(bottles.id, bottle.id))
              .returning()
          )[0]
        : bottle;

      if (alias && !alias.bottleId) {
        const [newAlias] = await tx
          .update(bottleAliases)
          .set({
            bottleId: bottle.id,
          })
          .where(
            and(
              eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
              isNull(bottleAliases.bottleId),
            ),
          )
          .returning();

        // someone beat us to it?
        if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
          const [existingBottle] = await tx
            .select()
            .from(bottles)
            .where(eq(bottles.id, newAlias.bottleId));
          throw new ConflictError(existingBottle);
        }

        newAliases.push(alias.name);
      }

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: newBottle.id,
        createdById: user.id,
        displayName: newBottle.fullName,
        type: "update",
        data: {
          ...bottleData,
          distillerIds: newDistillerIds,
        },
      });

      return newBottle;
    });

    if (!newBottle) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update bottle.",
      });
    }

    try {
      await pushUniqueJob(
        "OnBottleChange",
        { bottleId: bottle.id },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
      });
    }

    for (const aliasName of newAliases) {
      try {
        await pushUniqueJob(
          "OnBottleAliasChange",
          { name: aliasName },
          { delay: 5000 },
        );
      } catch (err) {
        logError(err, {
          bottle: {
            id: bottle.id,
          },
        });
      }
    }

    // Queue search vector indexing for the new series
    // TODO: only run this when series is created
    if (bottle.seriesId && seriesCreated) {
      await pushUniqueJob("IndexBottleSeriesSearchVectors", {
        seriesId: bottle.seriesId,
      });
    }

    for (const entityId of newEntityIds.values()) {
      try {
        await pushUniqueJob("OnEntityChange", { entityId }, { delay: 5000 });
      } catch (err) {
        logError(err, {
          entity: {
            id: entityId,
          },
        });
      }
    }

    return await serialize(BottleSerializer, newBottle, context.user);
  });
