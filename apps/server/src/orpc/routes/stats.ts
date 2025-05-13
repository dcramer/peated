import { db } from "@peated/server/db";
import { bottles, entities, tastings } from "@peated/server/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/stats" })
  .output(
    z.object({
      totalTastings: z.number(),
      totalBottles: z.number(),
      totalEntities: z.number(),
    }),
  )
  .handler(async function () {
    const [{ totalTastings }] = await db
      .select({
        totalTastings: sql<number>`COUNT(${tastings.id})`,
      })
      .from(tastings);

    const [{ totalBottles }] = await db
      .select({
        totalBottles: sql<number>`COUNT(${bottles.id})`,
      })
      .from(bottles);

    const [{ totalEntities }] = await db
      .select({
        totalEntities: sql<number>`COUNT(${entities.id})`,
      })
      .from(entities);

    return {
      totalTastings,
      totalBottles,
      totalEntities,
    };
  });
