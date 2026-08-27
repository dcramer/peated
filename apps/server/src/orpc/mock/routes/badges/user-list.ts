import {
  mockBadges,
  mockBadgeUsers,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.badges.userList.handler(
  async ({ input, context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    if (!mockBadges.some((badge) => badge.id === input.badge)) {
      throw errors.NOT_FOUND({ message: "Mock badge not found." });
    }

    const users = input.badge === mockBadges[0]!.id ? mockBadgeUsers : [];
    return mockPage(users, input.cursor, input.limit);
  },
);
