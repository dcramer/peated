import { db } from "@peated/server/db";
import type { Bottle, Entity } from "@peated/server/db/schema";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { notEmpty } from "@peated/server/lib/filter";
import { normalizeBottleName } from "@peated/server/lib/normalize";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
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

    if (input.statedAge !== undefined && input.statedAge !== bottle.statedAge) {
      bottleData.statedAge = input.statedAge;
    }
    if (
      (input.name && input.name !== bottle.name) ||
      (input.statedAge !== undefined && input.statedAge !== bottle.statedAge)
    ) {
      bottleData.statedAge = bottleData.statedAge ?? bottle.statedAge;
      bottleData.name = normalizeBottleName(
        input.name || bottle.name,
        bottleData.statedAge,
      );
      if (
        bottleData.name.indexOf("-year-old") !== -1 &&
        !bottleData.statedAge
      ) {
        throw new TRPCError({
          message: "You should include the Stated Age of the bottle.",
          code: "BAD_REQUEST",
        });
      }
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
        bottleData.fullName = `${brand.name} ${bottleData.name ?? bottle.name}`;
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
          (d) => distillerIds.indexOf(d.id) === -1,
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

      const newEntityIds = Array.from(
        new Set([
          bottleData?.brandId,
          ...newDistillerIds,
          bottleData?.bottlerId,
        ]),
      ).filter(notEmpty);
      if (newEntityIds.length) {
        await tx
          .update(entities)
          .set({ totalBottles: sql`${entities.totalBottles} + 1` })
          .where(inArray(entities.id, newEntityIds));
      }

      const removedEntityIds = Array.from(
        new Set([
          bottleData?.brandId ? bottle.brandId : undefined,
          ...removedDistillerIds,
          bottleData?.bottlerId ? bottle.bottlerId : undefined,
        ]),
      ).filter(notEmpty);
      if (removedEntityIds.length) {
        await tx
          .update(entities)
          .set({ totalBottles: sql`${entities.totalBottles} - 1` })
          .where(inArray(entities.id, removedEntityIds));
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
    )
      await pushJob("GenerateBottleDetails", { bottleId: bottle.id });

    return await serialize(BottleSerializer, newBottle, ctx.user);
  });
