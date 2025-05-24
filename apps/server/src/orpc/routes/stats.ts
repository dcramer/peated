import { db } from "@peated/server/db";
import { bottles, entities, tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { sql } from "drizzle-orm";
import { z } from "zod";

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
        totalTastings: sql<string>`COUNT(${tastings.id})`,
      })
      .from(tastings);

    const [{ totalBottles }] = await db
      .select({
        totalBottles: sql<string>`COUNT(${bottles.id})`,
      })
      .from(bottles);

    const [{ totalEntities }] = await db
      .select({
        totalEntities: sql<string>`COUNT(${entities.id})`,
      })
      .from(entities);

    return {
      totalTastings: Number(totalTastings),
      totalBottles: Number(totalBottles),
      totalEntities: Number(totalEntities),
    };
  });
