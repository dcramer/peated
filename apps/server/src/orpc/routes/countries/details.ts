import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import countryDetailsContract from "@peated/server/orpc/contracts/countries/details";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { eq, sql } from "drizzle-orm";

export default implement(countryDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [country] = await db
    .select()
    .from(countries)
    .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()));

  if (!country) {
    throw errors.NOT_FOUND({
      message: "Country not found.",
    });
  }

  return await serialize(CountrySerializer, country, context.user);
});
