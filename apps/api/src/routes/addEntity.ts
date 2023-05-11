import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { NewEntity, changes, entities } from "../db/schema";
import { db } from "../db";

export default {
  method: "POST",
  url: "/entities",
  schema: {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        country: { type: "string" },
        region: { type: "string" },
        type: {
          type: "array",
          items: {
            type: "string",
            enum: ["distiller", "brand"],
          },
        },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;
    const data: NewEntity = {
      ...body,
      type: body.type || [],
      createdById: req.user.id,
    };

    const entity = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values(data)
        .onConflictDoNothing()
        .returning();

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        createdById: req.user.id,
        data: JSON.stringify(data),
      });

      return entity;
    });

    res.status(201).send(entity);
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: NewEntity;
  }
>;
