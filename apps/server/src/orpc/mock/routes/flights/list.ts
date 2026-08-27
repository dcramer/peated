import {
  includesQuery,
  mockFlights,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.flights.list.handler(async ({ input, context }) => {
  const flights = mockFlights
    .filter(
      (flight) =>
        includesQuery(input.query, flight.name, flight.description) &&
        (flight.public || flight.createdBy?.id === context.user?.id) &&
        (input.filter === undefined ||
          input.filter === "none" ||
          (input.filter === "public" && flight.public) ||
          (input.filter === "private" && !flight.public)),
    )
    .toSorted((left, right) =>
      input.sort === "-name"
        ? right.name.localeCompare(left.name)
        : left.name.localeCompare(right.name),
    );

  return mockPage(flights, input.cursor, input.limit);
});
