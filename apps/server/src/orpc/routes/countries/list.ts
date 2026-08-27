import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import countryListContract from "@peated/server/orpc/contracts/countries/list";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { and, asc, desc, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";

export default implement(countryListContract).handler(async function ({
  input: { cursor, query, limit, ...input },
  context,
}) {
  const where: (SQL<unknown> | undefined)[] = [];

  const offset = (cursor - 1) * limit;
  if (query) {
    where.push(ilike(countries.name, `%${query}%`));
  }

  if (input.hasBottles) {
    where.push(ne(countries.totalBottles, 0));
  }

  if (input.onlyMajor) {
    where.push(
      inArray(
        sql`LOWER(${countries.slug})`,
        MAJOR_COUNTRIES.map(([, slug]) => slug),
      ),
    );
  }

  let orderBy: SQL<unknown>;
  switch (input.sort) {
    case "name":
      orderBy = asc(countries.name);
      break;
    case "-name":
      orderBy = desc(countries.name);
      break;
    case "bottles":
      orderBy = asc(countries.totalBottles);
      break;
    case "-bottles":
      orderBy = desc(countries.totalBottles);
      break;
  }

  const results = await db
    .select()
    .from(countries)
    .where(where ? and(...where) : undefined)
    .limit(limit + 1)
    .offset(offset)
    .orderBy(orderBy);

  return {
    results: await serialize(
      CountrySerializer,
      results.slice(0, limit),
      context.user,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
