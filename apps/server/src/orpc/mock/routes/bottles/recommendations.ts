import {
  mockBottles,
  mockRecommendationBottlesFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";
import { BOTTLE_RECOMMENDATION_REASON } from "@peated/server/schemas";

export default mockOS.bottles.recommendations.handler(
  async ({ input, context, errors }) => {
    if (!mockBottles.some((bottle) => bottle.id === input.bottle)) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return {
      reason: BOTTLE_RECOMMENDATION_REASON,
      results: mockRecommendationBottlesFor(context.user, input.bottle).slice(
        0,
        input.limit,
      ),
    };
  },
);
