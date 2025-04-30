import { sql } from "drizzle-orm";
import { db } from "../db";
import { bottles, entities, tastings } from "../db/schema";
import { publicProcedure } from "../trpc";

export default publicProcedure.query(async function () {
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
