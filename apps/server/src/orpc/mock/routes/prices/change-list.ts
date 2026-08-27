import {
  includesQuery,
  mockPage,
  mockPriceChangesFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.prices.changeList.handler(async ({ input, context }) => {
  const priceChanges = mockPriceChangesFor(context.user).filter((change) =>
    includesQuery(input.query, change.bottle.fullName, change.bottle.name),
  );
  return mockPage(priceChanges, input.cursor, input.limit);
});
