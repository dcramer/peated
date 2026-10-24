import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  editEntityHistory,
  nextEventId,
  putLegacyEvent,
  toLegacyEvent,
} from "@peated/server/lib/entityAbout/legacyEvents";
import {
  EntityAboutVersionError,
  EntityAboutWriteError,
} from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityEventInputSchema,
  EntityEventSchema,
} from "@peated/server/schemas";
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
      "Add a dated item to an entity's history. Every item needs a `sourceUrl`. Requires moderator privileges.",
    operationId: "createEntityEvent",
  })
  .input(InputSchema)
  .output(EntityEventSchema)
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select({ id: entities.id, name: entities.name, kind: entities.kind })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });
    if (input.newOwnerId === entity.id) {
      throw errors.BAD_REQUEST({ message: "An entity cannot acquire itself." });
    }
    if (!input.sourceUrl) {
      throw errors.BAD_REQUEST({
        message: "Add a source URL for this history item.",
      });
    }

    let eventId = 0;
    try {
      const saved = await db.transaction(async (tx) =>
        editEntityHistory(tx, {
          entity,
          actor: await getUserActorForDatabase(tx, context.user),
          edit: (document) => {
            eventId = nextEventId(document);
            return putLegacyEvent(
              document,
              eventId,
              {
                kind: input.kind,
                date: input.date,
                description: input.description ?? null,
                newOwnerId: input.newOwnerId ?? null,
                sourceUrl: input.sourceUrl ?? null,
              },
              new Date().toISOString(),
            );
          },
        }),
      );
      const event = saved.document.events.find((item) => item.id === eventId);
      const result =
        event && toLegacyEvent(entity.id, event, saved.document.sources);
      if (!result) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to create entity event.",
        });
      }
      return result;
    } catch (error) {
      if (error instanceof EntityAboutVersionError) {
        throw errors.CONFLICT({ message: error.message });
      }
      if (error instanceof EntityAboutWriteError) {
        if (
          error.reasons.some((reason) => reason.startsWith("Linked entity"))
        ) {
          throw errors.NOT_FOUND({ message: "New owner not found." });
        }
        throw errors.BAD_REQUEST({ message: error.reasons.join(" ") });
      }
      throw error;
    }
  });
