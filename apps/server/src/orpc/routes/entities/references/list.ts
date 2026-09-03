import { db } from "@peated/server/db";
import { entities, entityReferences } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/references",
    summary: "List Entity references",
    description:
      "Inspect names used for automatic entity matching. Intended for internal catalog maintenance; use entity aliases for names shown to users.",
    operationId: "listEntityReferences",
    // Entity references serve matching maintenance; aliases serve public display.
    spec: (spec) => ({
      ...spec,
      "x-internal": true,
      "x-badges": [{ name: "Internal", position: "before" }],
    }),
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          name: z.string(),
          isEntityName: z.boolean(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    const results = await db
      .select()
      .from(entityReferences)
      .where(eq(entityReferences.entityId, entity.id))
      .orderBy(asc(entityReferences.name));

    return {
      results: results.map((reference) => ({
        name: reference.name,
        isEntityName: reference.name === entity.name,
        createdAt: reference.createdAt.toISOString(),
      })),
    };
  });
