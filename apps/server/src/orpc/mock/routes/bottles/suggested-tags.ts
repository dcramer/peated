import {
  mockBottleDetailsList,
  mockBottleSuggestedTagsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.suggestedTags.handler(
  async ({ input, errors }) => {
    const bottle = mockBottleDetailsList.find(
      (candidate) => candidate.id === input.bottle,
    );
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return mockBottleSuggestedTagsFor(bottle);
  },
);
