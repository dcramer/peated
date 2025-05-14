import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { countries, regions, type NewRegion } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import { RegionInputSchema, RegionSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import slugify from "@sindresorhus/slugify";
import { and, eq, ne, sql } from "drizzle-orm";

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/regions" })
  .input(RegionInputSchema)
  .output(RegionSchema)
  .handler(async function ({ input, context }) {
    const [country] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.id, input.country))
      .limit(1);
    if (!country) {
      throw new ORPCError("NOT_FOUND", {
        message: "Country not found.",
      });
    }

    const data: NewRegion = {
      ...input,
      slug: slugify(input.name),
      countryId: input.country,
    };

    if (data.description && data.description !== "") {
      data.descriptionSrc =
        input.descriptionSrc ||
        (input.description && input.description !== null ? "user" : null);
    }

    const [newRegion] = await db.transaction(async (tx) => {
      try {
        return await tx.insert(regions).values(data).returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "region_slug_unq") {
          const [existingRegion] = await db
            .select()
            .from(regions)
            .where(
              and(
                eq(sql`LOWER(${regions.slug})`, data.slug.toLowerCase()),
                eq(regions.countryId, data.countryId),
              ),
            );
          throw new ConflictError(existingRegion, err);
        } else if (
          err?.code === "23505" &&
          err?.constraint === "region_name_unq"
        ) {
          const [existingRegion] = await db
            .select()
            .from(regions)
            .where(
              and(
                eq(sql`LOWER(${regions.name})`, data.name.toLowerCase()),
                eq(regions.countryId, data.countryId),
              ),
            );
          throw new ConflictError(existingRegion, err);
        }
        throw err;
      }
    });

    if (!newRegion) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update region.",
      });
    }

    return await serialize(RegionSerializer, newRegion, context.user);
  });
