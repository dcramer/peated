import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { eventFactId } from "@peated/server/lib/entityAbout/display";
import { removeFacts } from "@peated/server/lib/entityAbout/document";
import { editEntityHistory } from "@peated/server/lib/entityAbout/legacyEvents";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { withAboutRouteErrors } from "@peated/server/orpc/errors";
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

    await withAboutRouteErrors(async () => {
      await db.transaction(async (tx) => {
        const stored = await getEntityAbout(tx, entity.id, { forUpdate: true });
        if (
          !stored?.document.events.some((event) => event.id === input.event)
        ) {
          throw errors.NOT_FOUND({ message: "History item not found." });
        }
        await editEntityHistory(tx, {
          entity,
          actor: await getUserActorForDatabase(tx, context.user),
          edit: (document) =>
            removeFacts(document, new Set([eventFactId(input.event)])),
        });
      });
    });

    return {};
  });
