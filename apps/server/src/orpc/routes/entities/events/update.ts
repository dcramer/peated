import { db } from "@peated/server/db";
import { changes, entities, entityEvents } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityEventInputFields,
  EntityEventInputSchema,
  EntityEventSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityEventSerializer } from "@peated/server/serializers/entityEvent";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  entity: z.coerce.number(),
  event: z.coerce.number(),
  kind: EntityEventInputFields.kind.optional(),
  date: EntityEventInputFields.date.optional(),
  description: EntityEventInputFields.description,
  newOwnerId: EntityEventInputFields.newOwnerId,
  sourceUrl: EntityEventInputFields.sourceUrl,
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/entities/{entity}/events/{event}",
    summary: "Update entity history",
    description:
      "Update an item in an entity's history. Requires moderator privileges.",
    operationId: "updateEntityEvent",
  })
  .input(InputSchema)
  .output(EntityEventSchema)
  .handler(async function ({ input, context, errors }) {
    const event = await db.transaction(async (tx) => {
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

      const nextInput = EntityEventInputSchema.safeParse({
        kind: input.kind ?? event.kind,
        date: input.date ?? event.date,
        description:
          input.description !== undefined
            ? input.description
            : event.description,
        newOwnerId:
          input.newOwnerId !== undefined
            ? input.newOwnerId
            : input.kind !== undefined && input.kind !== "acquired"
              ? null
              : event.newOwnerId,
        sourceUrl:
          input.sourceUrl !== undefined ? input.sourceUrl : event.sourceUrl,
      });
      if (!nextInput.success) {
        throw errors.BAD_REQUEST({
          message: nextInput.error.issues[0]?.message ?? "Invalid event.",
        });
      }

      if (nextInput.data.newOwnerId) {
        if (nextInput.data.newOwnerId === event.entityId) {
          throw errors.BAD_REQUEST({
            message: "An entity cannot acquire itself.",
          });
        }
        const [owner] = await tx
          .select({ id: entities.id })
          .from(entities)
          .where(eq(entities.id, nextInput.data.newOwnerId))
          .limit(1);
        if (!owner) {
          throw errors.NOT_FOUND({ message: "New owner not found." });
        }
      }

      const data: Partial<typeof entityEvents.$inferInsert> = {};
      if (nextInput.data.kind !== event.kind) data.kind = nextInput.data.kind;
      if (nextInput.data.date !== event.date) data.date = nextInput.data.date;
      if (nextInput.data.description !== event.description) {
        data.description = nextInput.data.description ?? null;
      }
      if (nextInput.data.newOwnerId !== event.newOwnerId) {
        data.newOwnerId = nextInput.data.newOwnerId ?? null;
      }
      if (nextInput.data.sourceUrl !== event.sourceUrl) {
        data.sourceUrl = nextInput.data.sourceUrl ?? null;
      }
      if (!Object.keys(data).length) return event;
      data.updatedAt = new Date();

      const [updatedEvent] = await tx
        .update(entityEvents)
        .set(data)
        .where(eq(entityEvents.id, event.id))
        .returning();
      if (!updatedEvent) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update entity event.",
        });
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
        data: {
          entityEvent: {
            action: "update",
            id: event.id,
            ...data,
          },
        },
      });

      return updatedEvent;
    });

    return await serialize(EntityEventSerializer, event, context.user);
  });
