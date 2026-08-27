import { mockChanges, mockPage } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.changes.list.handler(
  async ({ input, context, errors }) => {
    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const userId = input.user === "me" ? context.user?.id : input.user;
    const changes = mockChanges.filter(
      (change) =>
        (input.type === undefined || change.objectType === input.type) &&
        (userId === undefined ||
          (change.createdByActor.type === "user" &&
            change.createdByActor.key === String(userId))),
    );
    return mockPage(changes, input.cursor, input.limit);
  },
);
