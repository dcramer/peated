import {
  mockBottle,
  mockEntity,
  mockTastingFor,
  mockUser,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const userMatches =
      input.user === undefined ||
      input.user === "me" ||
      input.user === mockUser.id ||
      input.user === mockUser.username;
    if (input.user !== undefined && !userMatches) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    const matches =
      userMatches &&
      (input.bottle === undefined || input.bottle === mockBottle.id) &&
      (input.entity === undefined || input.entity === mockEntity.id);

    return {
      results: matches ? [mockTastingFor(context.user)] : [],
      rel: noMorePages,
    };
  },
);
