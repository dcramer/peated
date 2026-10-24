import { db } from "@peated/server/db";
import { entityAboutNotes } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityAboutNoteSchema } from "@peated/server/schemas/entityAbout";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/entities/{entity}/about/notes",
    summary: "List entity About notes",
    description:
      "List the notes every About writer run reads for an entity, oldest first. Requires moderator privileges.",
    operationId: "listEntityAboutNotes",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(z.object({ results: z.array(EntityAboutNoteSchema) }))
  .handler(async ({ input }) => {
    const rows = await db
      .select()
      .from(entityAboutNotes)
      .where(eq(entityAboutNotes.entityId, input.entity))
      .orderBy(asc(entityAboutNotes.id));
    return {
      results: rows.map((row) => ({
        id: row.id,
        text: row.text,
        sourceUrl: row.sourceUrl,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });
