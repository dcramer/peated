import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { markPersonEdits } from "@peated/server/lib/entityAbout/document";
import {
  EntityAboutVersionError,
  EntityAboutWriteError,
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityAboutDocumentSchema,
  EntityAboutSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityAboutSerializer } from "@peated/server/serializers/entityAbout";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  entity: z.coerce.number(),
  version: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe(
      "Version the edit is based on, or `null` when the entity has no About page yet.",
    ),
  document: EntityAboutDocumentSchema,
});

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/entities/{entity}/about",
    summary: "Update entity About page",
    description:
      "Replace an entity's About document. Items you add or change are recorded as written by a person, and the About writer never changes them. Every new or changed event, site fact, and sentence needs a source. Rejects an edit based on an older `version`. Requires moderator privileges.",
    operationId: "updateEntityAbout",
  })
  .input(InputSchema)
  .output(EntityAboutSchema)
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select({ id: entities.id, name: entities.name, kind: entities.kind })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    try {
      const saved = await db.transaction(async (tx) => {
        const stored = await getEntityAbout(tx, entity.id);
        const actor = await getUserActorForDatabase(tx, context.user);
        return await saveEntityAbout(tx, {
          entity,
          document: markPersonEdits(
            stored?.document ?? null,
            input.document,
            new Date().toISOString(),
          ),
          expectedVersion: input.version,
          actor,
          checkedOn: new Date().toISOString().slice(0, 10),
        });
      });
      return await serialize(
        EntityAboutSerializer,
        { ...saved, id: saved.entityId },
        context.user,
      );
    } catch (error) {
      if (error instanceof EntityAboutVersionError) {
        throw errors.CONFLICT({ message: error.message });
      }
      if (error instanceof EntityAboutWriteError) {
        throw errors.BAD_REQUEST({
          message: `${error.message} ${error.reasons.join(" ")}`,
        });
      }
      throw error;
    }
  });
