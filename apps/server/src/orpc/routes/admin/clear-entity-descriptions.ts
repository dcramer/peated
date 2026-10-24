import { db } from "@peated/server/db";
import { changes, entities } from "@peated/server/db/schema";
import {
  ABOUT_WRITER_SYSTEM_ACTOR_KEY,
  getSystemActorForDatabase,
} from "@peated/server/lib/actors";
import { getPublishedLeadText } from "@peated/server/lib/entityAbout/publicAbout";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, asc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/clear-entity-descriptions",
    summary: "Clear unsourced descriptions",
    description:
      "Clear generated descriptions on distilleries and brands that do not match their About page lead. Run after the About writer has covered every Entity. Descriptions a person wrote are kept. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "clearEntityDescriptions",
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
          .describe("Number of Entities to check"),
      })
      .strict(),
  )
  .output(
    z.object({
      cleared: z.number(),
      checked: z.number(),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        id: entities.id,
        name: entities.name,
        description: entities.description,
      })
      .from(entities)
      .where(
        and(
          gt(entities.id, input.afterId),
          inArray(entities.kind, ["distillery", "brand"]),
          eq(entities.descriptionSrc, "generated"),
          isNotNull(entities.description),
        ),
      )
      .orderBy(asc(entities.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);

    const actor = await getSystemActorForDatabase(
      db,
      ABOUT_WRITER_SYSTEM_ACTOR_KEY,
    );
    let cleared = 0;
    for (const entity of page) {
      await db.transaction(async (tx) => {
        // Description rule (owner: docs/features/entity-about.md): a generated
        // description stays only when it is the published About lead.
        const about = await getEntityAbout(tx, entity.id);
        if (getPublishedLeadText(about) === entity.description) return;

        const [updated] = await tx
          .update(entities)
          .set({
            description: null,
            descriptionSrc: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(entities.id, entity.id),
              eq(entities.descriptionSrc, "generated"),
            ),
          )
          .returning({ id: entities.id });
        if (!updated) return;
        await tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          displayName: entity.name,
          actorId: actor.id,
          type: "update",
          data: { description: null, descriptionSrc: null },
        });
        cleared += 1;
      });
    }

    return {
      cleared,
      checked: page.length,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
