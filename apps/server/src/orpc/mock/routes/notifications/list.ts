import { mockNotifications, mockPage } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.notifications.list.handler(
  async ({ input, context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }

    const notifications =
      input.filter === "unread"
        ? mockNotifications.filter((notification) => !notification.read)
        : mockNotifications;
    return mockPage(notifications, input.cursor, input.limit);
  },
);
