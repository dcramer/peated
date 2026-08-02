import { db } from "@peated/server/db";
import { countries, regions, type NewRegion } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireMod } from "@peated/server/orpc/middleware";
import { RegionInputSchema, RegionSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import slugify from "@sindresorhus/slugify";
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
      "Update a region name and description. Renaming regenerates its slug. Requires moderator privileges",
    operationId: "updateRegion",
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

    const data: Partial<NewRegion> = {};

    if (input.name !== undefined) {
      const desiredSlug = slugify(input.name);
      if (input.name !== region.name) data.name = input.name;
      if (desiredSlug !== region.slug) data.slug = desiredSlug;
    }

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

    let newRegion: typeof regions.$inferSelect | undefined;
    try {
      [newRegion] = await db
        .update(regions)
        .set(data)
        .where(eq(regions.id, region.id))
        .returning();
    } catch (error: any) {
      const conflictField =
        error?.code === "23505" && error?.constraint === "region_slug_unq"
          ? regions.slug
          : error?.code === "23505" && error?.constraint === "region_name_unq"
            ? regions.name
            : null;
      if (!conflictField) throw error;

      const conflictValue =
        conflictField === regions.slug ? data.slug : data.name;
      const [existingRegion] = await db
        .select()
        .from(regions)
        .where(
          and(
            eq(regions.countryId, countryId),
            eq(sql`LOWER(${conflictField})`, conflictValue!.toLowerCase()),
          ),
        );
      throw new ConflictError(existingRegion, error);
    }

    if (!newRegion) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update region.",
      });
    }

    return await serialize(RegionSerializer, newRegion, context.user);
  });
