import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { RegionInputSchema, RegionSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = RegionInputSchema.partial().extend({
  region: z.string(),
  country: z.string(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/countries/{country}/regions/{region}",
    summary: "Update region",
    description:
      "Update region information including description. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(RegionSchema)
  .handler(async function ({ input, context, errors }) {
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
        throw errors.BAD_REQUEST({
          message: "Invalid country.",
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
          eq(sql`LOWER(${regions.slug})`, input.region.toLowerCase()),
        ),
      );

    if (!region) {
      throw errors.NOT_FOUND({
        message: "Region not found.",
      });
    }

    const data: { [name: string]: any } = {};

    if (
      input.description !== undefined &&
      input.description !== region.description
    ) {
      data.description = input.description;
      data.descriptionSrc =
        input.descriptionSrc ||
        (input.description && input.description !== null ? "user" : null);
    }

    if (Object.values(data).length === 0) {
      return await serialize(RegionSerializer, region, context.user);
    }

    const [newRegion] = await db
      .update(regions)
      .set(data)
      .where(
        and(
          eq(regions.countryId, countryId),
          eq(sql`LOWER(${regions.slug})`, region.slug.toLowerCase()),
        ),
      )
      .returning();

    if (!newRegion) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update region.",
      });
    }

    return await serialize(RegionSerializer, newRegion, context.user);
  });
