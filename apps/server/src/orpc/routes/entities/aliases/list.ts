import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/aliases",
    summary: "List entity aliases",
    description:
      "Retrieve all aliases for a specific entity, indicating which is canonical",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          name: z.string(),
          isCanonical: z.boolean(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async function ({ input, errors }) {
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
      .from(entityAliases)
      .where(and(eq(entityAliases.entityId, entity.id)));

    return {
      results: results.map((a) => ({
        name: a.name,
        isCanonical: a.name === entity.name,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });
