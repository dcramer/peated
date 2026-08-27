import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import regionDetailsContract from "@peated/server/orpc/contracts/regions/details";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import { and, eq, sql } from "drizzle-orm";

export default implement(regionDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  let countryId: number;
  if (Number.isFinite(+input.country)) {
    countryId = Number(input.country);
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

  return await serialize(RegionSerializer, region, context.user);
});
