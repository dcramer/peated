import {
  mockFlight,
  mockFlightDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.flights.details.handler(
  async ({ input, context, errors }) => {
    if (input.flight !== mockFlight.id) {
      throw errors.NOT_FOUND({ message: "Mock flight not found." });
    }

    return mockFlightDetailsFor(context.user);
  },
);
