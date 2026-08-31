import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { asc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/aliases",
    summary: "List Bottle aliases",
    description: "List verified alternate marketed names for a Bottle.",
    operationId: "listBottleAliases",
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(
    z.object({
      results: z.array(
        z.object({ id: z.number(), name: z.string(), createdAt: z.string() }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    let [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));
    if (!bottle) {
      [bottle] = await db
        .select({ ...getTableColumns(bottles) })
        .from(bottleTombstones)
        .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
        .where(eq(bottleTombstones.bottleId, input.bottle));
    }
    if (!bottle) throw errors.NOT_FOUND({ message: "Bottle not found." });

    const aliases = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, bottle.id))
      .orderBy(asc(bottleAliases.name), asc(bottleAliases.id));
    return {
      results: aliases.map((alias) => ({
        id: alias.id,
        name: alias.name,
        createdAt: alias.createdAt.toISOString(),
      })),
    };
  });
