import {
  mockBottleDetailsFor,
  mockBottleDetailsList,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.details.handler(
  async ({ input, context, errors }) => {
    const bottle = mockBottleDetailsList.find(
      (candidate) => candidate.id === input.bottle,
    );
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return mockBottleDetailsFor(context.user, bottle);
  },
);
