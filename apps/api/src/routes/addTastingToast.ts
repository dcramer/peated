import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import { tastings, toasts } from "../db/schema";
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
    const tasting = first(
      await db
        .select()
        .from(tastings)
        .where(eq(tastings.id, req.params.tastingId)),
    );

    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    if (req.user.id === tasting.createdById) {
      return res.status(400).send({ error: "Cannot toast yourself" });
    }

    await db
      .insert(toasts)
      .values({
        createdById: req.user.id,
        tastingId: tasting.id,
      })
      .onConflictDoNothing()
      .returning();

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
