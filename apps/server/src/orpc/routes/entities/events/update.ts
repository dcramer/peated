import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  editEntityHistory,
  isLegacyKind,
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
  EntityEventInputFields,
  EntityEventInputSchema,
  EntityEventSchema,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  entity: z.coerce.number(),
  event: z.coerce.number(),
  kind: EntityEventInputFields.kind.optional(),
  date: EntityEventInputFields.date.optional(),
  description: EntityEventInputFields.description,
  newOwnerId: EntityEventInputFields.newOwnerId,
  newOwnerName: EntityEventInputFields.newOwnerName,
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
    const [entity] = await db
      .select({ id: entities.id, name: entities.name, kind: entities.kind })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "History item not found." });

    try {
      const saved = await db.transaction(async (tx) =>
        editEntityHistory(tx, {
          entity,
          actor: await getUserActorForDatabase(tx, context.user),
          edit: (document) => {
            const before = document.events.find((e) => e.id === input.event);
            const legacy =
              before && toLegacyEvent(entity.id, before, document.sources);
            if (!before || !legacy || !isLegacyKind(before.kind)) {
              throw errors.NOT_FOUND({ message: "History item not found." });
            }
            const next = EntityEventInputSchema.safeParse({
              kind: input.kind ?? legacy.kind,
              date: input.date ?? legacy.date,
              description:
                input.description !== undefined
                  ? input.description
                  : legacy.description,
              newOwnerId:
                input.newOwnerId !== undefined
                  ? input.newOwnerId
                  : input.kind !== undefined && input.kind !== "acquired"
                    ? null
                    : legacy.newOwnerId,
              // Keeps a name-only owner unless the edit sets an owner or
              // changes the kind.
              newOwnerName:
                input.newOwnerName !== undefined
                  ? input.newOwnerName
                  : input.newOwnerId ||
                      (input.kind !== undefined && input.kind !== "acquired")
                    ? null
                    : legacy.newOwnerName,
              sourceUrl:
                input.sourceUrl !== undefined
                  ? input.sourceUrl
                  : legacy.sourceUrl,
            });
            if (!next.success) {
              throw errors.BAD_REQUEST({
                message: next.error.issues[0]?.message ?? "Invalid event.",
              });
            }
            if (next.data.newOwnerId === entity.id) {
              throw errors.BAD_REQUEST({
                message: "An entity cannot acquire itself.",
              });
            }
            return putLegacyEvent(
              document,
              before.id,
              {
                kind: next.data.kind,
                date: next.data.date,
                description: next.data.description ?? null,
                newOwnerId: next.data.newOwnerId ?? null,
                newOwnerName: next.data.newOwnerName ?? null,
                sourceUrl: next.data.sourceUrl ?? null,
              },
              new Date().toISOString(),
            );
          },
        }),
      );
      const event = saved.document.events.find((e) => e.id === input.event);
      const result =
        event && toLegacyEvent(entity.id, event, saved.document.sources);
      if (!result) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update entity event.",
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
