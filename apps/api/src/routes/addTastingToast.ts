import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "@peated/core/db";
import { tastings, toasts } from "@peated/core/db/schema";
import { createNotification } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/tastings/:tastingId/toasts",
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

    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) => eq(tastings.id, req.params.tastingId),
    });

    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    if (req.user.id === tasting.createdById) {
      return res.status(400).send({ error: "Cannot toast yourself" });
    }

    const user = req.user;
    await db.transaction(async (tx) => {
      const [toast] = await tx
        .insert(toasts)
        .values({
          createdById: user.id,
          tastingId: tasting.id,
        })
        .onConflictDoNothing()
        .returning();

      if (toast) {
        await tx
          .update(tastings)
          .set({ toasts: sql`${tastings.toasts} + 1` })
          .where(eq(tastings.id, tasting.id));

        createNotification(tx, {
          fromUserId: toast.createdById,
          type: "toast",
          objectId: toast.id,
          createdAt: toast.createdAt,
          userId: tasting.createdById,
        });
      }
    });

    res.status(200).send({});
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
