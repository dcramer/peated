import { eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "../db";
import {
  bottleTags,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/bottles/:bottleId",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId))
      .limit(1);
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
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

    const user = req.user;
    await db.transaction(async (tx) => {
      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: bottle.id,
        createdAt: bottle.createdAt,
        createdById: user.id,
        displayName: bottle.fullName,
        type: "delete",
        data: JSON.stringify({
          ...bottle,
          distillerIds,
        }),
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
    res.status(204).send();
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
  }
>;
