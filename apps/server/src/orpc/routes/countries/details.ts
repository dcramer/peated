import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CountrySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/countries/:slug" })
  .input(
    z.object({
      slug: z.string(),
    }),
  )
  .output(CountrySchema)
  .handler(async function ({ input, context }) {
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(sql`LOWER(${countries.slug})`, input.slug.toLowerCase()));

    if (!country) {
      throw new ORPCError("NOT_FOUND", {
        message: "Country not found.",
      });
    }

    return await serialize(CountrySerializer, country, context.user);
  });
