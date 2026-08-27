import {
  includesQuery,
  mockCountry,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.countries.list.handler(async ({ input }) => {
  const matches =
    includesQuery(input.query, mockCountry.name, mockCountry.slug) &&
    (!input.hasBottles || mockCountry.totalBottles > 0);

  return {
    results: matches ? [mockCountry] : [],
    rel: noMorePages,
  };
});
