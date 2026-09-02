import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { getBottleFlavorProfile } from "@peated/server/lib/bottleFlavorProfile";
import { bottleProducedIn } from "@peated/server/lib/bottleProductionLocation";
import { implement } from "@peated/server/orpc";
import flavorProfileContract from "@peated/server/orpc/contracts/regions/flavor-profile";
import { and, eq, sql } from "drizzle-orm";

export default implement(flavorProfileContract).handler(
  async ({ input, errors }) => {
    const countryWhere = Number.isFinite(+input.country)
      ? eq(countries.id, Number(input.country))
      : eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase());
    const [country] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(countryWhere)
      .limit(1);
    if (!country) throw errors.NOT_FOUND({ message: "Country not found." });

    const regionWhere = Number.isFinite(+input.region)
      ? eq(regions.id, Number(input.region))
      : eq(sql`LOWER(${regions.slug})`, input.region.toLowerCase());
    const [region] = await db
      .select({ id: regions.id })
      .from(regions)
      .where(and(eq(regions.countryId, country.id), regionWhere))
      .limit(1);
    if (!region) throw errors.NOT_FOUND({ message: "Region not found." });

    return getBottleFlavorProfile(bottleProducedIn({ regionId: region.id }));
  },
);
