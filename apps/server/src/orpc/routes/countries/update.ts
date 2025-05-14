import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { CountryInputSchema, CountrySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = CountryInputSchema.partial().extend({
  slug: z.string(),
});

export default procedure
  .use(requireMod)
  .route({ method: "PATCH", path: "/countries/:slug" })
  .input(InputSchema)
  .output(CountrySchema)
  .handler(async function ({ input, context }) {
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(sql`LOWER(${countries.slug})`, input.slug.toLowerCase()));

    if (!country) {
      throw new ORPCError("NOT_FOUND");
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
      return await serialize(CountrySerializer, country, context.user);
    }

    const [newCountry] = await db
      .update(countries)
      .set(data)
      .where(eq(sql`LOWER(${countries.slug})`, country.slug))
      .returning();

    if (!newCountry) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update country.",
      });
    }

    return await serialize(CountrySerializer, newCountry, context.user);
  });
