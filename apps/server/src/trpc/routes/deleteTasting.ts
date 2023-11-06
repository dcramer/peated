import { db } from "@peated/server/db";
import {
  bottleTags,
  bottles,
  notifications,
  tastings,
  toasts,
} from "@peated/server/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/tastings/:tastingId",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, req.params.tastingId))
      .limit(1);
    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    if (tasting.createdById !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, "toast"),
            inArray(
              notifications.objectId,
              sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${tasting.id})`,
            ),
          ),
        );

      await tx.delete(toasts).where(eq(toasts.tastingId, tasting.id));
      await tx.delete(tastings).where(eq(tastings.id, tasting.id));

      // update aggregates after tasting row is removed
      for (const tag of tasting.tags) {
        await tx
          .update(bottleTags)
          .set({
            count: sql`${bottleTags.count} - 1`,
          })
          .where(
            and(
              eq(bottleTags.bottleId, tasting.bottleId),
              eq(bottleTags.tag, tag),
            ),
          );
      }

      await tx
        .update(bottles)
        .set({
          totalTastings: sql`${bottles.totalTastings} - 1`,
          avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
        })
        .where(eq(bottles.id, tasting.bottleId));

      // TODO: update badge qualifiers
      // TODO: update entities.totalTastings
    });
    res.status(204).send();
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
  }
>;
