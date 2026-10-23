import { mockPage, mockTastingDrafts } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastingDrafts.list.handler(
  async ({ input, context, errors }) => {
    if (!context.user) throw errors.UNAUTHORIZED();
    return mockPage(mockTastingDrafts, input.cursor, input.limit);
  },
);
