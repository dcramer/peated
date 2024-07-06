import { db } from "@peated/server/db";
import { countries, regions, type NewRegion } from "@peated/server/db/schema";
import { RegionInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import slugify from "@sindresorhus/slugify";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { type z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";
import { ConflictError } from "../errors";

export async function regionCreate({
  input,
  ctx,
}: {
  input: z.infer<typeof RegionInputSchema>;
  ctx: Context;
}) {
  const [country] = await db
    .select({ id: countries.id })
    .from(countries)
    .where(eq(countries.id, input.country))
    .limit(1);
  if (!country) {
    throw new TRPCError({
      message: "Country not found.",
      code: "NOT_FOUND",
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
              eq(regions.slug, data.slug),
              eq(regions.countryId, data.countryId),
            ),
          );
        throw new ConflictError(existingRegion, err);
      }
      throw err;
    }
  });

  if (!newRegion) {
    throw new TRPCError({
      message: "Failed to update region.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(RegionSerializer, newRegion, ctx.user);
}

export default modProcedure.input(RegionInputSchema).mutation(regionCreate);
