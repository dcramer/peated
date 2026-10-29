import { db } from "@peated/server/db";
import { entities, entityAbout } from "@peated/server/db/schema";
import {
  ABOUT_WRITER_SYSTEM_ACTOR_KEY,
  getSystemActorForDatabase,
} from "@peated/server/lib/actors";
import {
  getDescriptionUpdate,
  updateEntityDescription,
} from "@peated/server/lib/entityAbout/description";
import { toStoredEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/sync-entity-descriptions",
    summary: "Set descriptions from About leads",
    description:
      "Set each Entity's description to its published About lead, the same way every About save does. Descriptions a person wrote are kept; the old text stays in the change history. Use `dryRun` to list what would change without changing anything. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "syncEntityDescriptions",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Check Entities with IDs greater than this value"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(100)
          .describe("Number of About pages to check"),
        dryRun: z
          .boolean()
          .default(false)
          .describe("List the descriptions that would change, but change none"),
      })
      .strict(),
  )
  .output(
    z.object({
      updates: z
        .array(
          z.object({
            entityId: z.number(),
            name: z.string(),
            before: z.string().nullable(),
            description: z.string(),
          }),
        )
        .describe("Descriptions changed, or that would change in a dry run"),
      checked: z.number(),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await db
      .select({ name: entities.name, about: entityAbout })
      .from(entityAbout)
      .innerJoin(entities, eq(entities.id, entityAbout.entityId))
      .where(
        and(
          eq(entityAbout.status, "published"),
          gt(entityAbout.entityId, input.afterId),
        ),
      )
      .orderBy(asc(entityAbout.entityId))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const actor = await getSystemActorForDatabase(
      db,
      ABOUT_WRITER_SYSTEM_ACTOR_KEY,
    );

    const updates = [];
    for (const row of page) {
      const about = toStoredEntityAbout(row.about);
      const entity = { id: about.entityId, name: row.name };
      const update = await db.transaction(async (tx) => {
        const found = await getDescriptionUpdate(tx, entity.id, about);
        if (found && !input.dryRun) {
          await updateEntityDescription(tx, entity, about, actor);
        }
        return found;
      });
      if (!update) continue;
      updates.push({
        entityId: entity.id,
        name: entity.name,
        before: update.before.description,
        description: update.description,
      });
    }

    return {
      updates,
      checked: page.length,
      nextAfterId:
        rows.length > input.limit ? page.at(-1)!.about.entityId : null,
    };
  });
