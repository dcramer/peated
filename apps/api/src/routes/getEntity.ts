import { db } from "@peated/core/db";
import { entities } from "@peated/core/db/schema";
import { EntitySchema } from "@peated/core/schemas";
import { serialize } from "@peated/core/serializers";
import { EntitySerializer } from "@peated/core/serializers/entity";
import { eq, getTableColumns, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

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
      200: zodToJsonSchema(EntitySchema),
    },
  },
  handler: async (req, res) => {
    const [entity] = await db
      .select({
        ...getTableColumns(entities),
        location: sql`ST_AsGeoJSON(${entities.location}) as location`,
      })
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
