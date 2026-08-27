import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.notifications.count.handler(
  async ({ input, context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }

    return { count: input.filter === "unread" ? 3 : 5 };
  },
);
