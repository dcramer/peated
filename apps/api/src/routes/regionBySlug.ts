import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";
import { type Context } from "../trpc/context";

export async function regionBySlug({
  input,
  ctx,
}: {
  input: {
    country: string | number;
    slug: string;
  };
  ctx: Context;
}) {
  let countryId: number;
  if (typeof input.country === "number") {
    countryId = input.country;
  } else {
    const [result] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()))
      .limit(1);
    if (!result) {
      throw new TRPCError({
        message: "Invalid country",
        code: "BAD_REQUEST",
      });
    }
    countryId = result.id;
  }

  const [region] = await db
    .select()
    .from(regions)
    .where(
      and(
        eq(regions.countryId, countryId),
        eq(sql`LOWER(${regions.slug})`, input.slug),
      ),
    );

  if (!region) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  return await serialize(RegionSerializer, region, ctx.user);
}

export default publicProcedure
  .input(
    z.object({
      slug: z.string(),
      country: z.union([z.number(), z.string()]),
    }),
  )
  .query(regionBySlug);
