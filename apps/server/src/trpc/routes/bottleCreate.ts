import { db } from "@peated/server/db";
import type { Bottle, Entity } from "@peated/server/db/schema";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { upsertEntity } from "@peated/server/lib/db";
import { notEmpty } from "@peated/server/lib/filter";
import { normalizeBottleName } from "@peated/server/lib/normalize";
import { BottleInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { inArray, sql } from "drizzle-orm";
import { authedProcedure } from "..";

export default authedProcedure
  .input(BottleInputSchema)
  .mutation(async function ({ input, ctx }) {
    let name = normalizeBottleName(input.name, input.statedAge);
    if (name.indexOf("-year-old") !== -1 && !input.statedAge) {
      throw new TRPCError({
        message: "You should include the Stated Age of the bottle.",
        code: "BAD_REQUEST",
      });
    }

    const user = ctx.user;
    const bottle: Bottle | undefined = await db.transaction(async (tx) => {
      const brandUpsert = await upsertEntity({
        db: tx,
        data: input.brand,
        type: "brand",
        userId: user.id,
      });

      if (!brandUpsert) {
        throw new TRPCError({
          message: "Could not identify brand.",
          code: "BAD_REQUEST",
        });
      }

      const brand = brandUpsert.result;

      // TODO: we need to pull all this name uniform logic into a shared helper, as this
      // is missing from updateBottle
      if (name.indexOf(brand.name) === 0) {
        name = name.substring(brand.name.length + 1);
      }

      let bottler: Entity | null = null;
      if (input.bottler) {
        const bottlerUpsert = await upsertEntity({
          db: tx,
          data: input.bottler,
          type: "bottler",
          userId: user.id,
        });
        if (bottlerUpsert) {
          bottler = bottlerUpsert.result;
        } else {
          throw new TRPCError({
            message: "Could not identify bottler.",
            code: "BAD_REQUEST",
          });
        }
      }

      const fullName = [brand.name, name].filter(Boolean).join(" ");

      let bottle: Bottle | undefined;
      try {
        [bottle] = await tx
          .insert(bottles)
          .values({
            name,
            fullName,
            statedAge: input.statedAge || null,
            category: input.category || null,
            brandId: brand.id,
            bottlerId: bottler?.id || null,
            createdById: user.id,
          })
          .returning();
      } catch (err: any) {
        if (
          err?.code === "23505" &&
          (err?.constraint === "bottle_brand_unq" ||
            err?.constraint === "bottle_name_unq")
        ) {
          throw new TRPCError({
            message: "Bottle with name already exists under brand.",
            code: "CONFLICT",
          });
        }
        throw err;
      }
      if (!bottle) {
        return;
      }

      const distillerIds: number[] = [];
      if (input.distillers)
        for (const distData of input.distillers) {
          const distUpsert = await upsertEntity({
            db: tx,
            data: distData,
            userId: user.id,
            type: "distiller",
          });
          if (!distUpsert) {
            throw new TRPCError({
              message: "Could not identify distiller.",
              code: "BAD_REQUEST",
            });
          }
          await tx.insert(bottlesToDistillers).values({
            bottleId: bottle.id,
            distillerId: distUpsert.id,
          });

          distillerIds.push(distUpsert.id);
        }

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: bottle.id,
        createdAt: bottle.createdAt,
        createdById: user.id,
        displayName: bottle.fullName,
        type: "add",
        data: {
          ...bottle,
          distillerIds,
        },
      });

      await tx
        .update(entities)
        .set({ totalBottles: sql`${entities.totalBottles} + 1` })
        .where(
          inArray(
            entities.id,
            Array.from(
              new Set([brand.id, ...distillerIds, bottler?.id]),
            ).filter(notEmpty),
          ),
        );

      return bottle;
    });

    if (!bottle) {
      throw new TRPCError({
        message: "Failed to create bottle.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    await pushJob("GenerateBottleDetails", { bottleId: bottle.id });

    return await serialize(BottleSerializer, bottle, ctx.user);
  });
