import {
  includesQuery,
  mockFlight,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.flights.list.handler(async ({ input }) => {
  const matches =
    includesQuery(input.query, mockFlight.name, mockFlight.description) &&
    input.filter !== "private";

  return {
    results: matches ? [mockFlight] : [],
    rel: noMorePages,
  };
});
