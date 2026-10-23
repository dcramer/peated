import { mockTastingDrafts } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastingDrafts.count.handler(
  async ({ context, errors }) => {
    if (!context.user) throw errors.UNAUTHORIZED();
    return { count: mockTastingDrafts.length };
  },
);
