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
      totalBrands: z.number(),
      totalDistilleries: z.number(),
      totalBottlers: z.number(),
      totalBlenders: z.number(),
      totalCompanies: z.number(),
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

    const [entityTotals] = await db
      .select({
        totalEntities: sql<string>`COUNT(${entities.id})`,
        totalBrands: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'brand')`,
        totalDistilleries: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'distillery')`,
        totalBottlers: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'bottler')`,
        totalBlenders: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'blender')`,
        totalCompanies: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'company')`,
      })
      .from(entities);

    return {
      totalTastings: Number(totalTastings),
      totalBottles: Number(totalBottles),
      totalEntities: Number(entityTotals.totalEntities),
      totalBrands: Number(entityTotals.totalBrands),
      totalDistilleries: Number(entityTotals.totalDistilleries),
      totalBottlers: Number(entityTotals.totalBottlers),
      totalBlenders: Number(entityTotals.totalBlenders),
      totalCompanies: Number(entityTotals.totalCompanies),
    };
  });
