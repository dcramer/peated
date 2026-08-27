import {
  mockComments,
  mockCommentsByTasting,
  mockPage,
  mockUser,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.comments.list.handler(
  async ({ input, context, errors }) => {
    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    if (!context.user?.admin && !input.tasting && !input.user) {
      return mockPage([], input.cursor, input.limit);
    }

    const comments = input.tasting
      ? (mockCommentsByTasting.get(input.tasting) ?? [])
      : mockComments;
    const userId = input.user === "me" ? mockUser.id : input.user;
    const results = comments.filter(
      (comment) => userId === undefined || comment.createdBy.id === userId,
    );

    return mockPage(results, input.cursor, input.limit);
  },
);
