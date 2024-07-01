import { db } from "@peated/server/db";
import { type SerializedPoint } from "@peated/server/db/columns/geoemetry";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { TRPCError } from "@trpc/server";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { type Context } from "../context";

export async function countryBySlug({
  input,
  ctx,
}: {
  input: string;
  ctx: Context;
}) {
  const [country] = await db
    .select({
      ...getTableColumns(countries),
      location: sql<SerializedPoint>`ST_AsGeoJSON(${countries.location}) as location`,
    })
    .from(countries)
    .where(eq(countries.slug, input));

  const [{ totalDistilleries }] = await db
    .select({ totalDistilleries: sql<number>`COUNT(*)` })
    .from(entities)
    .where(
      and(
        eq(entities.countryId, country.id),
        sql`'distiller' = ANY(${entities.type})`,
      ),
    );

  const [{ totalBottles }] = await db
    .select({ totalBottles: sql<number>`COUNT(*)` })
    .from(bottles)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.bottleId, bottles.id),
    )
    .innerJoin(entities, eq(bottlesToDistillers.distillerId, entities.id))
    .where(and(eq(entities.countryId, country.id)));

  if (!country) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  return {
    ...(await serialize(CountrySerializer, country, ctx.user)),
    totalDistilleries,
    totalBottles,
  };
}

export default publicProcedure.input(z.string()).query(countryBySlug);
