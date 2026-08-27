import {
  includesQuery,
  mockCountries,
  mockPage,
  mockRegions,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.regions.list.handler(async ({ input, errors }) => {
  const country = mockCountries.find(
    (candidate) =>
      candidate.slug === input.country.toLowerCase() ||
      candidate.id === Number(input.country),
  );
  if (!country) {
    throw errors.BAD_REQUEST({ message: "Invalid mock country." });
  }

  const direction = input.sort.startsWith("-") ? -1 : 1;
  const sort = input.sort.replace(/^-/, "");
  const regions = mockRegions
    .filter(
      (region) =>
        region.country.id === country.id &&
        includesQuery(input.query, region.name, region.slug) &&
        (!input.hasBottles || region.totalBottles > 0),
    )
    .toSorted((left, right) =>
      sort === "bottles"
        ? direction * (left.totalBottles - right.totalBottles)
        : direction * left.name.localeCompare(right.name),
    );

  return mockPage(regions, input.cursor, input.limit);
});
