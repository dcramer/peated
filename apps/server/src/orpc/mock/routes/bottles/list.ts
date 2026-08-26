import {
  includesQuery,
  mockBottleFor,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "following" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const bottle = mockBottleFor(context.user);
    return {
      results: includesQuery(input.query, bottle.fullName, bottle.name)
        ? [bottle]
        : [],
      rel: noMorePages,
      followedDistillerCount: input.filter === "following" ? 1 : null,
    };
  },
);
