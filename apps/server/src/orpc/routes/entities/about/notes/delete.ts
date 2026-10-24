import { db } from "@peated/server/db";
import { entityAboutNotes } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/about/notes/{note}",
    summary: "Remove an entity About note",
    description:
      "Remove a note so later About writer runs no longer read it. Requires moderator privileges.",
    operationId: "deleteEntityAboutNote",
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
      note: z.coerce.number().int().positive(),
    }),
  )
  .output(z.object({}))
  .handler(async ({ input, errors }) => {
    const [removed] = await db
      .delete(entityAboutNotes)
      .where(
        and(
          eq(entityAboutNotes.id, input.note),
          eq(entityAboutNotes.entityId, input.entity),
        ),
      )
      .returning({ id: entityAboutNotes.id });
    if (!removed) throw errors.NOT_FOUND({ message: "Note not found." });
    return {};
  });
