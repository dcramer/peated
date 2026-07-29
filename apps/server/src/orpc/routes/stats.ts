import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { and, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/stats",
    summary: "Get platform statistics",
    description:
      "Retrieve overall platform statistics including total tastings, bottles, and entities",
    spec: (spec) => ({
      ...spec,
      operationId: "getStats",
    }),
  })
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
      .from(bottles)
      .where(
        and(
          isNotNull(bottles.groupId),
          sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
        ),
      );

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
