import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { CountryInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
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
    .where(eq(countries.slug, input.slug));

  if (!country) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  const data: { [name: string]: any } = {};

  if (input.name && input.name !== country.name) {
    data.name = input.name;
  }
  if (input.slug && input.slug !== country.slug) {
    data.slug = input.slug;
  }
  if (
    input.description !== undefined &&
    input.description !== country.description
  ) {
    data.description = input.description;
    data.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }

  if (Object.values(data).length === 0) {
    return await serialize(CountrySerializer, country, ctx.user);
  }

  const [newCountry] = await db
    .update(countries)
    .set(data)
    .where(eq(countries.slug, country.slug))
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
