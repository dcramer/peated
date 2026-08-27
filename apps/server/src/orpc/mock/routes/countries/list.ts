import {
  includesQuery,
  mockCountries,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.countries.list.handler(async ({ input }) => {
  const direction = input.sort.startsWith("-") ? -1 : 1;
  const sort = input.sort.replace(/^-/, "");
  const countries = mockCountries
    .filter(
      (country) =>
        includesQuery(input.query, country.name, country.slug) &&
        (!input.hasBottles || country.totalBottles > 0),
    )
    .toSorted((left, right) =>
      sort === "bottles"
        ? direction * (left.totalBottles - right.totalBottles)
        : direction * left.name.localeCompare(right.name),
    );

  return mockPage(countries, input.cursor, input.limit);
});
