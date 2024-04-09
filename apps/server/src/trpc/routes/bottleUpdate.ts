import { db } from "@peated/server/db";
import type { Bottle, Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { notEmpty } from "@peated/server/lib/filter";
import { logError } from "@peated/server/lib/log";
import { normalizeBottleName } from "@peated/server/lib/normalize";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";
import { upsertEntity } from "../../lib/db";

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

    const bottleData: { [name: string]: any } = {};
    const [normName, normStatedAge] =
      input.name || input.statedAge !== undefined
        ? normalizeBottleName(
            input.name || bottle.name,
            input.statedAge !== undefined ? input.statedAge : bottle.statedAge,
          )
        : [input.name, input.statedAge];

    if (normName && normName !== bottle.name) {
      bottleData.name = normName;
    }

    if (normStatedAge !== undefined && normStatedAge !== bottle.statedAge) {
      bottleData.statedAge = normStatedAge;
    }

    if (input.category !== undefined && input.category !== bottle.category) {
      bottleData.category = input.category;
    }

    const user = ctx.user;
    const newBottle = await db.transaction(async (tx) => {
      let brand: Entity | null = null;
      if (input.brand) {
        if (
          typeof input.brand === "number"
            ? input.brand !== bottle.brand.id
            : input.brand.name !== bottle.brand.name
        ) {
          const brandUpsert = await upsertEntity({
            db: tx,
            data: input.brand,
            userId: user.id,
            type: "brand",
          });
          if (!brandUpsert)
            throw new TRPCError({
              message: `Unable to find entity: ${input.brand}.`,
              code: "INTERNAL_SERVER_ERROR",
            });
          if (brandUpsert.id !== bottle.brandId) {
            bottleData.brandId = brandUpsert.id;
          }
          brand = brandUpsert.result;
        }
      }

      if (input.bottler) {
        if (
          typeof input.bottler === "number"
            ? input.bottler !== bottle.bottler?.id
            : input.bottler.name !== bottle.bottler?.name
        ) {
          const bottlerUpsert = await upsertEntity({
            db: tx,
            data: input.bottler,
            userId: user.id,
            type: "bottler",
          });
          if (!bottlerUpsert) {
            throw new TRPCError({
              message: `Unable to find entity: ${input.bottler}.`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }
          if (bottlerUpsert.id !== bottle.bottlerId) {
            bottleData.bottlerId = bottlerUpsert.id;
          }
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
          });
        }
        throw err;
      }

      if (!newBottle) return;

      if (bottleData.name) {
        const existingAlias = await tx.query.bottleAliases.findFirst({
          where: ilike(bottleAliases.name, newBottle.fullName),
        });
        // TODO: consider deleting duplicate alias at this point
        if (!existingAlias) {
          await tx
            .update(bottleAliases)
            .set({
              name: newBottle.fullName,
            })
            .where(
              and(
                eq(bottleAliases.bottleId, newBottle.id),
                eq(bottleAliases.name, bottle.fullName),
              ),
            );
          // this should only happen on entity change
        } else if (
          !existingAlias.bottleId ||
          existingAlias.bottleId === newBottle.id
        ) {
          await tx
            .delete(bottleAliases)
            .where(
              and(
                eq(bottleAliases.bottleId, newBottle.id),
                eq(bottleAliases.name, bottle.fullName),
              ),
            );
        } else {
          throw new Error(
            `Duplicate alias found (${existingAlias.bottleId}). Not implemented.`,
          );
        }
      }

      const distillerIds: number[] = [];
      const newDistillerIds: number[] = [];
      const removedDistillerIds: number[] = [];
      const currentDistillers = bottle.bottlesToDistillers.map(
        (d) => d.distiller,
      );

      // find newly added distillers and connect them
      if (input.distillers) {
        for (const distData of input.distillers) {
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
          } else {
            distillerIds.push(distiller.id);
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

    if (
      newBottle.fullName !== bottle.fullName ||
      !newBottle.description ||
      !newBottle.tastingNotes ||
      newBottle.suggestedTags.length === 0
    ) {
      try {
        await pushJob("GenerateBottleDetails", { bottleId: bottle.id });
      } catch (err) {
        logError(err, {
          bottle: {
            id: bottle.id,
          },
        });
      }
    }

    return await serialize(BottleSerializer, newBottle, ctx.user);
  });
