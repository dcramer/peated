import {
  mockBottles,
  mockBottleTagsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.tags.handler(async ({ input, errors }) => {
  const bottle = mockBottles.find((candidate) => candidate.id === input.bottle);
  if (!bottle) {
    throw errors.NOT_FOUND({ message: "Mock bottle not found." });
  }

  const tags = mockBottleTagsFor(bottle);

  return {
    results: tags.results.slice(0, input.limit),
    totalCount: tags.totalCount,
  };
});
