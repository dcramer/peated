import { db } from "@peated/server/db";
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
} from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "DELETE",
    path: "/bottles/{bottle}",
    operationId: "deleteBottle",
    summary: "Delete bottle",
    description:
      "Permanently delete a bottle and create a tombstone record. Requires admin privileges",
  })
  .input(z.object({ bottle: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId } = input;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleId))
      .limit(1);
    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
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
          createdById: context.user.id,
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
