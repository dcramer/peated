import { db } from "@peated/server/db";
import type { Bottle, Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import { logError } from "@peated/server/lib/log";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";
import { upsertEntity } from "../../lib/db";
import { bottleNormalize } from "./bottlePreview";

export default modProcedure
  .input(
    BottleInputSchema.partial().extend({
      bottle: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
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
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    const bottleData: Record<string, any> = await bottleNormalize({
      input: {
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
        category: bottle.category,
        distillers: bottle.bottlesToDistillers.map((d) => ({
          id: d.distiller.id,
          name: d.distiller.name,
        })),
        ...input,
      },
      ctx,
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

    const user = ctx.user;
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
            data: bottleData.brand,
            userId: user.id,
            type: "brand",
          });
          if (!brandUpsert)
            throw new TRPCError({
              message: `Unable to find entity: ${bottleData.brand}.`,
              code: "INTERNAL_SERVER_ERROR",
            });
          if (brandUpsert.id !== bottle.brandId) {
            bottleData.brandId = brandUpsert.id;
          }
          brand = brandUpsert.result;
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
            data: bottleData.bottler,
            userId: user.id,
            type: "bottler",
          });
          if (!bottlerUpsert) {
            throw new TRPCError({
              message: `Unable to find entity: ${bottleData.bottler}.`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }
          if (bottlerUpsert.id !== bottle.bottlerId) {
            bottleData.bottlerId = bottlerUpsert.id;
          }
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
              data: distData,
              userId: user.id,
              type: "distiller",
            });
            if (!distUpsert) {
              throw new TRPCError({
                message: `Unable to find entity: ${distData}.`,
                code: "INTERNAL_SERVER_ERROR",
              });
            }

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
            (await db.query.entities.findFirst({
              where: eq(entities.id, bottle.brandId),
            })) || null;
          if (!brand) throw new Error("Unexpected");
        }
        bottleData.fullName = `${brand.shortName || brand.name} ${
          bottleData.name ?? bottle.name
        }`;
      }

      let newBottle: Bottle | undefined;
      try {
        newBottle = Object.values(bottleData).length
          ? (
              await tx
                .update(bottles)
                .set(bottleData)
                .where(eq(bottles.id, bottle.id))
                .returning()
            )[0]
          : bottle;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "bottle_brand_unq") {
          throw new TRPCError({
            message: "Bottle with name already exists under brand.",
            code: "CONFLICT",
            cause: err,
          });
        }
        throw err;
      }

      if (!newBottle) return;

      if (bottleData.name) {
        const existingAlias = await tx.query.bottleAliases.findFirst({
          where: ilike(bottleAliases.name, newBottle.fullName),
        });
        if (existingAlias?.bottleId === newBottle.id) {
          // we're good - likely renaming to an alias that already existed
        } else if (!existingAlias) {
          await tx.insert(bottleAliases).values({
            name: newBottle.fullName,
            bottleId: newBottle.id,
          });
        } else if (!existingAlias.bottleId) {
          await tx
            .update(bottleAliases)
            .set({
              bottleId: newBottle.id,
            })
            .where(and(eq(bottleAliases.name, newBottle.fullName)));
        } else {
          throw new Error(
            `Duplicate alias found (${existingAlias.bottleId}). Not implemented.`,
          );
        }
      }

      if (!brand) {
        brand = (await tx.query.entities.findFirst({
          where: (entities, { eq }) =>
            eq(entities.id, (newBottle as Bottle).brandId),
        })) as Entity;
      }

      const allEntityIds = [
        ...distillerIds,
        bottle.brandId,
        newBottle.brandId,
        bottle.bottlerId,
        newBottle.bottlerId,
      ].filter(notEmpty);

      // XXX: this could be more optimal, but accounting is a pita
      await tx
        .update(entities)
        .set({
          totalBottles: sql<number>`(
          SELECT COUNT(*)
          FROM ${bottles}
          WHERE (
            ${bottles.brandId} = ${entities.id}
            OR ${bottles.bottlerId} = ${entities.id}
            OR EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
              AND ${bottlesToDistillers.distillerId} = ${entities.id}
            )
          )
        )`,
        })
        .where(inArray(entities.id, allEntityIds));

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
      throw new TRPCError({
        message: "Failed to update bottle.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    try {
      await pushJob("OnBottleChange", { bottleId: bottle.id });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
      });
    }

    return await serialize(BottleSerializer, newBottle, ctx.user);
  });
