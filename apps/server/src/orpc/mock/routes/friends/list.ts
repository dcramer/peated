import {
  includesQuery,
  mockFriendships,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.friends.list.handler(
  async ({ input, context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }

    const friends = mockFriendships.filter(
      (friend) =>
        includesQuery(input.query, friend.user.username) &&
        (input.filter !== "pending" || friend.status === "pending") &&
        (input.filter !== "active" || friend.status === "friends"),
    );

    return mockPage(friends, input.cursor, input.limit);
  },
);
