import { db } from "@peated/server/db";
import { entities, entityAbout } from "@peated/server/db/schema";
import { hasEntityAboutPage } from "@peated/server/lib/entityAbout/display";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";
import { procedure } from "@peated/server/orpc";
import {
  ENTITY_ABOUT_SCHEMA_VERSION,
  EntityAboutDocumentSchema,
  EntityKindEnum,
} from "@peated/server/schemas";
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
        id: entities.id,
        name: entities.name,
        kind: entities.kind,
        document: entityAbout.document,
        schemaVersion: entityAbout.schemaVersion,
        version: entityAbout.version,
        checkedOn: entityAbout.checkedOn,
        updatedAt: entityAbout.updatedAt,
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
    const results = page.flatMap((row) => {
      if (row.schemaVersion !== ENTITY_ABOUT_SCHEMA_VERSION) return [];
      const about = toPublicEntityAbout(
        {
          entityId: row.id,
          document: EntityAboutDocumentSchema.parse(row.document),
          version: row.version,
          checkedOn: row.checkedOn,
        },
        new Map(),
      );
      return hasEntityAboutPage(about)
        ? [
            {
              id: row.id,
              name: row.name,
              kind: row.kind,
              updatedAt: row.updatedAt.toISOString(),
            },
          ]
        : [];
    });

    return {
      results,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
