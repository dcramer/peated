import { mockBottle, mockBottleTags } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.tags.handler(async ({ input, errors }) => {
  if (input.bottle !== mockBottle.id) {
    throw errors.NOT_FOUND({ message: "Mock bottle not found." });
  }

  return {
    results: mockBottleTags.results.slice(0, input.limit),
    totalCount: mockBottleTags.totalCount,
  };
});
