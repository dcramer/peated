import { db } from "@peated/server/db";
import { changes, entities, entityEvents } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityEventInputSchema,
  EntityEventSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityEventSerializer } from "@peated/server/serializers/entityEvent";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = EntityEventInputSchema.safeExtend({
  entity: z.coerce.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/events",
    summary: "Add to entity history",
    description:
      "Add a dated item to an entity's history. Requires moderator privileges.",
    operationId: "createEntityEvent",
  })
  .input(InputSchema)
  .output(EntityEventSchema)
  .handler(async function ({ input, context, errors }) {
    const event = await db.transaction(async (tx) => {
      const [entity] = await tx
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(eq(entities.id, input.entity))
        .limit(1);
      if (!entity) {
        throw errors.NOT_FOUND({ message: "Entity not found." });
      }

      if (input.newOwnerId) {
        if (input.newOwnerId === entity.id) {
          throw errors.BAD_REQUEST({
            message: "An entity cannot acquire itself.",
          });
        }
        const [owner] = await tx
          .select({ id: entities.id })
          .from(entities)
          .where(eq(entities.id, input.newOwnerId))
          .limit(1);
        if (!owner) {
          throw errors.NOT_FOUND({ message: "New owner not found." });
        }
      }

      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const [event] = await tx
        .insert(entityEvents)
        .values({
          entityId: entity.id,
          kind: input.kind,
          date: input.date,
          description: input.description ?? null,
          newOwnerId: input.newOwnerId ?? null,
          sourceUrl: input.sourceUrl ?? null,
          createdByActorId: actorId,
        })
        .returning();
      if (!event) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to create entity event.",
        });
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        actorId,
        type: "update",
        data: { entityEvent: { action: "add", ...event } },
      });

      return event;
    });

    return await serialize(EntityEventSerializer, event, context.user);
  });
