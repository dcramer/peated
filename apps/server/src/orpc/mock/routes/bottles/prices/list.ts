import {
  mockBottlePrices,
  mockBottles,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.prices.list.handler(async ({ input, errors }) => {
  if (!mockBottles.some((bottle) => bottle.id === input.bottle)) {
    throw errors.NOT_FOUND({ message: "Mock bottle not found." });
  }

  return {
    results: mockBottlePrices.filter(
      (price) =>
        price.bottle?.id === input.bottle &&
        (!input.onlyValid || price.isValid),
    ),
  };
});
