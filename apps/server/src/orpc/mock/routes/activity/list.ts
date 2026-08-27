import { mockActivity } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.activity.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const activity =
      input.filter === "friends"
        ? mockActivity.filter(
            (entry) => entry.createdBy.id !== context.user?.id,
          )
        : mockActivity;

    return {
      results: activity.slice(0, input.limit),
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    };
  },
);
