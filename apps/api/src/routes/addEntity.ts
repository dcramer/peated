import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { EntityInputSchema, EntitySchema } from "@peated/shared/schemas";

import { db } from "../db";
import type { NewEntity } from "../db/schema";
import { changes, entities } from "../db/schema";
import { serialize } from "../lib/serializers";
import { EntitySerializer } from "../lib/serializers/entity";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/entities",
  schema: {
    body: zodToJsonSchema(EntityInputSchema),
    response: {
      201: zodToJsonSchema(EntitySchema),
    },
  },
  preHandler: [requireAuth],
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

      if (!entity) {
        // see if we can update an existing entity to add a type
        const [existing] = await tx
          .select()
          .from(entities)
          .where(eq(entities.name, data.name));
        const missingTypes = data.type.filter(
          (x) => existing.type.indexOf(x) === -1,
        );
        if (missingTypes) {
          const [updated] = await tx
            .update(entities)
            .set({
              type: [...existing.type, ...missingTypes],
            })
            .where(eq(entities.name, data.name))
            .returning();
          return updated;
        }
        return null;
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        type: "add",
        createdAt: entity.createdAt,
        createdById: req.user.id,
        data: JSON.stringify(data),
      });

      return entity;
    });

    if (!entity) {
      return res.status(500).send({ error: "Failed to create entity" });
    }

    res.status(201).send(await serialize(EntitySerializer, entity, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof EntityInputSchema>;
  }
>;
