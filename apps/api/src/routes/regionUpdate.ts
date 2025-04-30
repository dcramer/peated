import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { RegionInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

const InputSchema = RegionInputSchema.partial().extend({
  country: z.union([z.string(), z.number()]),
  slug: z.string(),
});

export async function regionUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
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
    return await serialize(RegionSerializer, region, ctx.user);
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
    throw new TRPCError({
      message: "Failed to update region.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(RegionSerializer, newRegion, ctx.user);
}

export default modProcedure.input(InputSchema).mutation(regionUpdate);
