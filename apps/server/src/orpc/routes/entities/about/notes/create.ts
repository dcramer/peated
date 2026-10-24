import { db } from "@peated/server/db";
import { entities, entityAboutNotes } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityAboutNoteSchema } from "@peated/server/schemas/entityAbout";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/about/notes",
    summary: "Add an entity About note",
    description:
      "Add a note every About writer run reads for an entity, such as a fact to keep or a trap to avoid. Notes guide the writer; they are not sources and never appear on the page. Requires moderator privileges.",
    operationId: "createEntityAboutNote",
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
      text: z.string().trim().min(1).max(500),
      sourceUrl: z.string().url().nullable().default(null),
    }),
  )
  .output(EntityAboutNoteSchema)
  .handler(async ({ input, context, errors }) => {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity));
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    const actor = await getUserActor(context.user);
    const [note] = await db
      .insert(entityAboutNotes)
      .values({
        entityId: entity.id,
        text: input.text,
        sourceUrl: input.sourceUrl,
        createdByActorId: actor.id,
      })
      .returning();
    if (!note) throw new Error("Unable to add the note.");
    return {
      id: note.id,
      text: note.text,
      sourceUrl: note.sourceUrl,
      createdAt: note.createdAt.toISOString(),
    };
  });
