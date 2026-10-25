import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { listBottleCategoriesByProductionLocation } from "@peated/server/lib/bottleProductionLocation";
import { implement } from "@peated/server/orpc";
import countryCategoriesContract from "@peated/server/orpc/contracts/countries/categories";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default implement(countryCategoriesContract).handler(async function ({
  input,
  errors,
}) {
  let countryId: number;

  const countryNumber = z.number().safeParse(input.country);
  if (countryNumber.success) {
    countryId = countryNumber.data;
  } else {
    const countrySlug = z.string().parse(input.country);
    const [result] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(sql`LOWER(${countries.slug})`, countrySlug.toLowerCase()))
      .limit(1);
    if (!result) {
      throw errors.BAD_REQUEST({
        message: "Invalid country.",
      });
    }
    countryId = result.id;
  }

  const results = await listBottleCategoriesByProductionLocation({
    countryId,
  });

  return {
    results,
    totalCount: results.reduce((total, { count }) => total + count, 0),
  };
});
