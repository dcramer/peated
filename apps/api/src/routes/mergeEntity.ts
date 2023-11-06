import { eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { zodToJsonSchema } from "zod-to-json-schema";

import { EntityMergeSchema, EntitySchema } from "@peated/core/schemas";

import { db } from "@peated/core/db";
import type { Entity } from "@peated/core/db/schema";
import { bottles, bottlesToDistillers, entities } from "@peated/core/db/schema";
import pushJob from "@peated/core/jobs";
import { type z } from "zod";
import { requireMod } from "../middleware/auth";

// TODO: this should happen async
async function mergeEntitiesInto(
  toEntity: Entity,
  ...fromEntities: Entity[]
): Promise<Entity> {
  const fromEntityIds = fromEntities.map((e) => e.id);
  console.log(
    `Merging entities ${fromEntityIds.join(", ")} into ${toEntity.id}.`,
  );

  const totalBottles = fromEntities.reduce(
    (acc, ent) => acc + ent.totalBottles,
    0,
  );
  const totalTastings = fromEntities.reduce(
    (acc, ent) => acc + ent.totalTastings,
    0,
  );

  // TODO: this doesnt handle duplicate bottles
  return await db.transaction(async (tx) => {
    await tx
      .update(bottles)
      .set({
        brandId: toEntity.id,
      })
      .where(inArray(bottles.brandId, fromEntityIds));

    await tx
      .update(bottles)
      .set({
        bottlerId: toEntity.id,
      })
      .where(inArray(bottles.bottlerId, fromEntityIds));

    await tx
      .update(bottlesToDistillers)
      .set({
        distillerId: toEntity.id,
      })
      .where(inArray(bottlesToDistillers.distillerId, fromEntityIds));

    const [entity] = await tx
      .update(entities)
      .set({
        totalBottles: sql`${entities.totalBottles} + ${totalBottles}`,
        totalTastings: sql`${entities.totalTastings} + ${totalTastings}`,
      })
      .where(eq(entities.id, toEntity.id))
      .returning();

    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));

    return entity;
  });
}

export default {
  method: "POST",
  url: "/entities/:entityId/merge",
  schema: {
    params: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: { type: "number" },
      },
    },
    body: zodToJsonSchema(EntityMergeSchema),
    response: {
      200: zodToJsonSchema(EntitySchema),
    },
  },
  preHandler: [requireMod],
  handler: async (req, res) => {
    if (!req.user) return res.status(401);

    if (req.params.entityId == req.body.entityId) {
      return res
        .status(400)
        .send({ error: "Cannot merge an entity into itself" });
    }

    const [rootEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, req.params.entityId));

    if (!rootEntity) {
      return res.status(404).send({ error: "Not found" });
    }

    const [otherEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, req.body.entityId));

    if (!otherEntity) {
      return res.status(404).send({ error: "Not found" });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromEntity =
      req.body.direction === "mergeInto" ? rootEntity : otherEntity;
    const toEntity =
      req.body.direction === "mergeInto" ? otherEntity : rootEntity;

    const newEntity = await mergeEntitiesInto(toEntity, fromEntity);
    await pushJob("GenerateEntityDetails", { entityId: toEntity.id });

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
    Body: z.infer<typeof EntityMergeSchema>;
  }
>;
