import { db } from "@peated/server/db";
import { entities, entityAbout } from "@peated/server/db/schema";
import { hasPublishedAboutPage } from "@peated/server/lib/entityAbout/publicAbout";
import { toStoredEntityAbout } from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { EntityKindEnum } from "@peated/server/schemas";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entity-about/sitemap",
    summary: "List About pages for the sitemap",
    description:
      "List entities with a published About page, by entity ID. Continue with `nextAfterId` until it is null.",
    operationId: "listEntityAboutPages",
  })
  .input(
    z.object({
      afterId: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(0)
        .describe("List entities with IDs greater than this value"),
      limit: z.coerce.number().int().min(1).max(500).default(500),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          kind: EntityKindEnum,
          updatedAt: z.string().datetime(),
        }),
      ),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        entity: {
          id: entities.id,
          name: entities.name,
          kind: entities.kind,
        },
        about: entityAbout,
      })
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

    // Same tab rule as entity details, so the sitemap never lists a page
    // that would return not found.
    const results = page.flatMap(({ entity, about }) =>
      hasPublishedAboutPage(toStoredEntityAbout(about))
        ? [{ ...entity, updatedAt: about.updatedAt.toISOString() }]
        : [],
    );

    return {
      results,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.entity.id : null,
    };
  });
