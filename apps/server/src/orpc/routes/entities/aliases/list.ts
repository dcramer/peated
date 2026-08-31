import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/aliases",
    summary: "List Entity aliases",
    description: "List an Entity's other names, including its short name.",
    operationId: "listEntityAliases",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(
    z.object({
      results: z.array(
        z.object({
          id: z.number().nullable(),
          name: z.string(),
          isShortName: z.boolean(),
          createdAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const [entity] = await db
      .select({
        id: entities.id,
        name: entities.name,
        shortName: entities.shortName,
      })
      .from(entities)
      .where(eq(entities.id, input.entity));
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    const aliases = await db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.entityId, entity.id))
      .orderBy(asc(entityAliases.name), asc(entityAliases.id));
    const shortName = entity.shortName?.trim();
    return {
      results: [
        ...(shortName &&
        shortName.toLocaleLowerCase("en-US") !==
          entity.name.toLocaleLowerCase("en-US")
          ? [
              {
                id: null,
                name: shortName,
                isShortName: true,
                createdAt: null,
              },
            ]
          : []),
        ...aliases.map((alias) => ({
          id: alias.id,
          name: alias.name,
          isShortName: false,
          createdAt: alias.createdAt.toISOString(),
        })),
      ],
    };
  });
