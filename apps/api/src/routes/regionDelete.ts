import { countries, regions } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { adminProcedure } from "../trpc";

const InputSchema = z.object({
  country: z.union([z.string(), z.number()]),
  slug: z.string(),
});

export default adminProcedure.input(InputSchema).mutation(async function ({
  input,
  ctx,
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
        eq(sql`LOWER(${regions.slug})`, input.slug.toLowerCase()),
      ),
    );

  if (!region) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  await db
    .delete(regions)
    .where(
      and(
        eq(regions.countryId, countryId),
        eq(sql`LOWER(${regions.slug})`, region.slug.toLowerCase()),
      ),
    );

  return {};
});
