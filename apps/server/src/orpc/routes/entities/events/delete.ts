import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { pruneSources } from "@peated/server/lib/entityAbout/document";
import { editEntityHistory } from "@peated/server/lib/entityAbout/legacyEvents";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
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
    const [entity] = await db
      .select({ id: entities.id, name: entities.name, kind: entities.kind })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "History item not found." });

    await db.transaction(async (tx) =>
      editEntityHistory(tx, {
        entity,
        actor: await getUserActorForDatabase(tx, context.user),
        edit: (document) => {
          if (!document.events.some((event) => event.id === input.event)) {
            throw errors.NOT_FOUND({ message: "History item not found." });
          }
          return pruneSources({
            ...document,
            events: document.events.filter((event) => event.id !== input.event),
            // Sentences that cite the removed item go with it; a section
            // about a removed era keeps its other text.
            sections: document.sections.flatMap((section) => {
              const sentences = section.sentences.filter(
                (sentence) =>
                  !sentence.factIds.includes(`event:${input.event}`),
              );
              if (!sentences.length) return [];
              return [
                {
                  ...section,
                  sentences,
                  eraEventId:
                    section.eraEventId === input.event
                      ? null
                      : section.eraEventId,
                },
              ];
            }),
          });
        },
      }),
    );

    return {};
  });
