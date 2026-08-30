import {
  mockBottle,
  mockRecommendationBottlesFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";
import { BOTTLE_RECOMMENDATION_REASON } from "@peated/server/schemas";

export default mockOS.bottles.recommendations.handler(
  async ({ input, context, errors }) => {
    if (input.bottle !== mockBottle.id) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return {
      reason: BOTTLE_RECOMMENDATION_REASON,
      results: mockRecommendationBottlesFor(context.user).slice(0, input.limit),
    };
  },
);
