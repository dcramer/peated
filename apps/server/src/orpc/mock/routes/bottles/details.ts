import {
  mockBottleDetails,
  mockBottleDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.details.handler(
  async ({ input, context, errors }) => {
    if (input.bottle !== mockBottleDetails.id) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return mockBottleDetailsFor(context.user);
  },
);
