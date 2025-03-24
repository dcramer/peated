import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";
import { db } from "../../db";
import {
  bottleAliases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
  reviews,
  storePrices,
} from "../../db/schema";
import { notEmpty } from "../../lib/filter";

export default adminProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, input))
    .limit(1);
  if (!bottle) {
    throw new TRPCError({
      message: "Bottle not found.",
      code: "NOT_FOUND",
    });
  }

  const distillerIds = (
    await db
      .select({ id: entities.id })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottle.id))
  ).map(({ id }) => id);

  await db.transaction(async (tx) => {
    await Promise.all([
      tx.insert(changes).values({
        objectType: "bottle",
        objectId: bottle.id,
        createdById: ctx.user.id,
        displayName: bottle.fullName,
        type: "delete",
        data: {
          ...bottle,
          distillerIds,
        },
      }),

      tx
        .update(entities)
        .set({ totalBottles: sql`${entities.totalBottles} - 1` })
        .where(
          and(
            inArray(
              entities.id,
              Array.from(
                new Set([bottle.brandId, ...distillerIds, bottle.bottlerId]),
              ).filter(notEmpty),
            ),
            gt(entities.totalBottles, 0),
          ),
        ),

      tx.delete(bottleTags).where(eq(bottleTags.bottleId, bottle.id)),

      tx
        .delete(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id)),

      tx
        .update(bottleAliases)
        .set({ bottleId: null })
        .where(eq(bottleAliases.bottleId, bottle.id)),

      tx
        .update(reviews)
        .set({ bottleId: null })
        .where(eq(reviews.bottleId, bottle.id)),

      tx
        .update(storePrices)
        .set({ bottleId: null })
        .where(eq(storePrices.bottleId, bottle.id)),

      tx.insert(bottleTombstones).values({
        bottleId: bottle.id,
      }),
    ]);
    await tx.delete(bottles).where(eq(bottles.id, bottle.id));
  });

  return {};
});
