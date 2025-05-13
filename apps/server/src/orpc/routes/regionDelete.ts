import { ORPCError } from "@orpc/server";
import { countries, regions } from "@peated/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { db } from "../../db";
import { requireAdmin } from "../middleware";

const InputSchema = z.object({
  country: z.union([z.string(), z.number()]),
  slug: z.string(),
});

export default procedure
  .use(requireAdmin)
  .route({ method: "DELETE", path: "/regions" })
  .input(InputSchema)
  .output(z.object({}))
  .handler(async function ({ input, context }) {
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
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid country",
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
      throw new ORPCError("NOT_FOUND", {
        message: "Region not found",
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
