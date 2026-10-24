import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { setEntityAboutStatus } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityAboutStatusEnum } from "@peated/server/schemas/entityAbout";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/entities/{entity}/about/status",
    summary: "Hide or show entity About page",
    description:
      "Hide an entity's About page or show it again. Hiding keeps the document, and the About writer never shows a hidden page. Requires moderator privileges.",
    operationId: "updateEntityAboutStatus",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      status: EntityAboutStatusEnum,
    }),
  )
  .output(z.object({ status: EntityAboutStatusEnum }))
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    const updated = await db.transaction(async (tx) =>
      setEntityAboutStatus(tx, {
        entity,
        status: input.status,
        actor: await getUserActorForDatabase(tx, context.user),
      }),
    );
    if (!updated) {
      throw errors.NOT_FOUND({ message: "This entity has no About page." });
    }
    return { status: input.status };
  });
