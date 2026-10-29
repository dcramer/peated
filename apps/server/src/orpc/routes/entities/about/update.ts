import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { updateEntityDescription } from "@peated/server/lib/entityAbout/description";
import { updateEntityFoundingYear } from "@peated/server/lib/entityAbout/foundingYear";
import { saveEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { withAboutRouteErrors } from "@peated/server/orpc/errors";
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
  entity: z.coerce.number().int().positive(),
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
      "Replace an entity's About document with a new version. Start from `GET /entities/{entity}/about/document`, which keeps source quotes; the public page leaves them out. Every event, site fact, and sentence needs a source. The About writer rewrites the whole page on its next run; earlier versions stay in change history. Rejects an edit based on an older `version`. Requires moderator privileges.",
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

    return await withAboutRouteErrors(async () => {
      const saved = await db.transaction(async (tx) => {
        const actor = await getUserActorForDatabase(tx, context.user);
        const result = await saveEntityAbout(tx, {
          entity,
          document: input.document,
          expectedVersion: input.version,
          actor,
        });
        await updateEntityDescription(tx, entity, result, actor);
        await updateEntityFoundingYear(tx, entity, result, actor);
        return result;
      });
      return await serialize(
        EntityAboutSerializer,
        { ...saved, id: saved.entityId },
        context.user,
      );
    });
  });
