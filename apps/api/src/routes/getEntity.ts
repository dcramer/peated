import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { entities } from "../db/schema";
import { serialize } from "../lib/serializers";
import { EntitySerializer } from "../lib/serializers/entity";

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
    response: {
      200: {
        $ref: "/schemas/entity",
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
    res.send(await serialize(EntitySerializer, entity, req.user));
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
