import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";
import { db } from "../../db";
import {
  bottleTags,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
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
    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      createdAt: bottle.createdAt,
      createdById: ctx.user.id,
      displayName: bottle.fullName,
      type: "delete",
      data: {
        ...bottle,
        distillerIds,
      },
    });

    await tx
      .update(entities)
      .set({ totalBottles: sql`${entities.totalBottles} - 1` })
      .where(
        inArray(
          entities.id,
          Array.from(
            new Set([bottle.brandId, ...distillerIds, bottle.bottlerId]),
          ).filter(notEmpty),
        ),
      );

    await tx.delete(bottleTags).where(eq(bottleTags.bottleId, bottle.id));
    await tx
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    await tx.delete(bottles).where(eq(bottles.id, bottle.id));
  });

  return {};
});
