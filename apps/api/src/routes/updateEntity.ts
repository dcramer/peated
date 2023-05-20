import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { EntityInputSchema, EntitySchema } from "@peated/shared/schemas";

import { db } from "../db";
import { changes, entities } from "../db/schema";
import { requireMod } from "../middleware/auth";

function arraysEqual<T>(one: T[], two: T[]) {
  if (one.length !== two.length) return false;
  for (let i = 0; i < one.length; i++) {
    if (one[i] !== two[i]) return false;
  }
  return true;
}

export default {
  method: "PUT",
  url: "/entities/:entityId",
  schema: {
    params: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: { type: "number" },
      },
    },
    body: zodToJsonSchema(EntityInputSchema.partial()),
    response: {
      200: zodToJsonSchema(EntitySchema),
    },
  },
  preHandler: [requireMod],
  handler: async (req, res) => {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, req.params.entityId));

    if (!entity) {
      return res.status(404).send({ error: "Not found" });
    }

    const body = req.body;
    const data: { [name: string]: any } = {};

    if (body.name && body.name !== entity.name) {
      data.name = body.name;
    }
    if (body.country !== undefined && body.country !== entity.country) {
      data.country = body.country;
    }
    if (body.region !== undefined && body.region !== entity.region) {
      data.region = body.region;
    }
    if (body.type !== undefined && !arraysEqual(body.type, entity.type)) {
      data.type = body.type;
    }

    if (Object.values(data).length === 0) {
      return res.status(200).send(entity);
    }

    const newEntity = await db.transaction(async (tx) => {
      const [newEntity] = await tx
        .update(entities)
        .set(data)
        .where(eq(entities.id, entity.id))
        .returning();

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: newEntity.id,
        createdById: req.user.id,
        data: JSON.stringify({
          ...data,
        }),
      });

      return newEntity;
    });

    res.status(200).send(newEntity);
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      entityId: number;
    };
    Body: Partial<z.infer<typeof EntityInputSchema>>;
  }
>;
