import { and, eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import {
  bottleTags,
  bottles,
  notifications,
  tastings,
  toasts,
} from "../db/schema";
import { objectTypeFromSchema } from "../lib/notifications";
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
            eq(notifications.objectType, objectTypeFromSchema(toasts)),
            inArray(
              notifications.objectId,
              sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${tasting.id})`,
            ),
          ),
        );

      await tx.delete(toasts).where(eq(toasts.tastingId, tasting.id));

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
        })
        .where(eq(bottles.id, tasting.bottleId));

      await tx.delete(tastings).where(eq(tastings.id, tasting.id));
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
