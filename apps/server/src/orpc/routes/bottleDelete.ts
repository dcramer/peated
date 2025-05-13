import { ORPCError } from "@orpc/server";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
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
import { requireAdmin } from "../middleware";

export default procedure
  .use(requireAdmin)
  .route({ method: "DELETE", path: "/bottles/:id" })
  .input(z.coerce.number())
  .output(z.object({}))
  .handler(async function ({ input, context }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input))
      .limit(1);
    if (!bottle) {
      throw new ORPCError("NOT_FOUND", {
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
