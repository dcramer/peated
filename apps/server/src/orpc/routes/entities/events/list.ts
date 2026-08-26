import { db } from "@peated/server/db";
import { entities, entityEvents } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { EntityEventSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityEventSerializer } from "@peated/server/serializers/entityEvent";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/events",
    summary: "List entity history",
    description: "List the dated items in an entity's history.",
    operationId: "listEntityEvents",
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(z.object({ results: z.array(EntityEventSchema) }))
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) {
      throw errors.NOT_FOUND({ message: "Entity not found." });
    }

    const events = await db
      .select()
      .from(entityEvents)
      .where(eq(entityEvents.entityId, entity.id))
      .orderBy(asc(entityEvents.date), asc(entityEvents.id));

    return {
      results: await serialize(EntityEventSerializer, events, context.user),
    };
  });
