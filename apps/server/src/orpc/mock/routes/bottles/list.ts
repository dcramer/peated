import { implement } from "@orpc/server";
import type { MockContext } from "@peated/server/orpc/mock/context";
import {
  includesQuery,
  mockBottleFor,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import list from "@peated/server/orpc/routes/bottles/list";

export default implement(list)
  .$context<MockContext>()
  .handler(async ({ input, context, errors }) => {
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
  });
