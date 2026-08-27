import {
  mockComment,
  mockTasting,
  mockUser,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.comments.list.handler(
  async ({ input, context, errors }) => {
    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    if (!context.user?.admin && !input.tasting && !input.user) {
      return { results: [], rel: noMorePages };
    }

    const userMatches =
      input.user === undefined ||
      input.user === "me" ||
      input.user === mockUser.id;
    const tastingMatches =
      input.tasting === undefined || input.tasting === mockTasting.id;

    return {
      results: userMatches && tastingMatches ? [mockComment] : [],
      rel: noMorePages,
    };
  },
);
