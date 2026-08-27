import {
  mockFlightDetailsFor,
  mockFlights,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.flights.details.handler(
  async ({ input, context, errors }) => {
    const flight = mockFlights.find(
      (candidate) => candidate.id === input.flight,
    );
    if (
      !flight ||
      (!flight.public && flight.createdBy?.id !== context.user?.id)
    ) {
      throw errors.NOT_FOUND({ message: "Mock flight not found." });
    }

    return mockFlightDetailsFor(context.user, flight);
  },
);
