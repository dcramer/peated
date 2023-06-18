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
import { requireAuth } from "../middleware/auth";

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
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId))
      .limit(1);
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    if (!req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
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
        createdById: req.user.id,
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
