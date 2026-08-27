import {
  matchesMockUser,
  mockBadgeAwards,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.badgeList.handler(
  async ({ input, context, errors }) => {
    if (!matchesMockUser(input.user, context.user)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    return mockPage(mockBadgeAwards, input.cursor, input.limit);
  },
);
