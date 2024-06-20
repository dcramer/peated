import { db } from "@peated/server/db";
import { type SerializedPoint } from "@peated/server/db/columns";
import { countries } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { TRPCError } from "@trpc/server";
import { eq, getTableColumns, sql } from "drizzle-orm";
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
  let [country] = await db
    .select({
      ...getTableColumns(countries),
      location: sql<SerializedPoint>`ST_AsGeoJSON(${countries.location}) as location`,
    })
    .from(countries)
    .where(eq(countries.slug, input));

  if (!country) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  return await serialize(CountrySerializer, country, ctx.user);
}

export default publicProcedure.input(z.string()).query(countryBySlug);
