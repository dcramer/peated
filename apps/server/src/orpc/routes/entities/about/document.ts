import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityAboutDocumentSchema,
  EntityAboutStatusEnum,
} from "@peated/server/schemas/entityAbout";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/entities/{entity}/about/document",
    summary: "Get entity About document",
    description:
      "Get the full stored About document to edit, including source quotes, who wrote each item, and hidden facts. Send it back to `PUT /entities/{entity}/about` with your changes and this `version`. Requires moderator privileges.",
    operationId: "getEntityAboutDocument",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(
    z.object({
      version: z.number().nullable(),
      status: EntityAboutStatusEnum.nullable(),
      checkedOn: z.string().nullable(),
      document: EntityAboutDocumentSchema.nullable(),
    }),
  )
  .handler(async function ({ input, errors }) {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    const stored = await getEntityAbout(db, entity.id);
    return {
      version: stored?.version ?? null,
      status: stored?.status ?? null,
      checkedOn: stored?.checkedOn ?? null,
      document: stored?.document ?? null,
    };
  });
