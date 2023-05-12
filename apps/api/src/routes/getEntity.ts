import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { entities } from "../db/schema";

export default {
  method: "GET",
  url: "/entities/:entityId",
  schema: {
    params: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, req.params.entityId));
    if (!entity) {
      return res.status(404).send({ error: "Not found" });
    }

    res.send(entity);
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      entityId: number;
    };
  }
>;
