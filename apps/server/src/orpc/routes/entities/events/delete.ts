import { db } from "@peated/server/db";
import { changes, entities, entityEvents } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/events/{event}",
    summary: "Remove from entity history",
    description:
      "Remove an item from an entity's history. Requires moderator privileges.",
    operationId: "deleteEntityEvent",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      event: z.coerce.number(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(entityEvents)
        .where(
          and(
            eq(entityEvents.id, input.event),
            eq(entityEvents.entityId, input.entity),
          ),
        )
        .for("update");
      if (!event) {
        throw errors.NOT_FOUND({ message: "History item not found." });
      }

      const [entity] = await tx
        .select({ name: entities.name })
        .from(entities)
        .where(eq(entities.id, event.entityId))
        .limit(1);
      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      await tx.insert(changes).values({
        objectType: "entity",
        objectId: event.entityId,
        displayName: entity?.name,
        actorId,
        type: "update",
        data: { entityEvent: { action: "delete", ...event } },
      });
      await tx.delete(entityEvents).where(eq(entityEvents.id, event.id));
    });

    return {};
  });
