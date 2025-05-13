import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { CountryInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";

const InputSchema = CountryInputSchema.partial().extend({
  slug: z.string(),
});

export async function countryUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const [country] = await db
    .select()
    .from(countries)
    .where(eq(sql`LOWER(${countries.slug})`, input.slug.toLowerCase()));

  if (!country) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  const data: { [name: string]: any } = {};

  if (
    input.description !== undefined &&
    input.description !== country.description
  ) {
    data.description = input.description;
    data.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  if (input.summary !== undefined && input.summary !== country.summary) {
    data.summary = input.summary;
  }

  if (Object.values(data).length === 0) {
    return await serialize(CountrySerializer, country, ctx.user);
  }

  const [newCountry] = await db
    .update(countries)
    .set(data)
    .where(eq(sql`LOWER(${countries.slug})`, country.slug))
    .returning();

  if (!newCountry) {
    throw new TRPCError({
      message: "Failed to update country.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(CountrySerializer, newCountry, ctx.user);
}

export default modProcedure.input(InputSchema).mutation(countryUpdate);
