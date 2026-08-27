import {
  includesQuery,
  mockCountry,
  mockRegion,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

function matchesCountry(value: string) {
  return (
    value.toLowerCase() === mockCountry.slug || Number(value) === mockCountry.id
  );
}

export default mockOS.regions.list.handler(async ({ input, errors }) => {
  if (!matchesCountry(input.country)) {
    throw errors.BAD_REQUEST({ message: "Invalid mock country." });
  }

  const matches =
    includesQuery(input.query, mockRegion.name, mockRegion.slug) &&
    (!input.hasBottles || mockRegion.totalBottles > 0);

  return {
    results: matches ? [mockRegion] : [],
    rel: noMorePages,
  };
});
