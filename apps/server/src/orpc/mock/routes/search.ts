import { implement } from "@orpc/server";
import type { MockContext } from "@peated/server/orpc/mock/context";
import {
  includesQuery,
  mockBottleFor,
  mockEntity,
  mockUser,
} from "@peated/server/orpc/mock/fixtures";
import type { Outputs } from "@peated/server/orpc/router";
import search from "@peated/server/orpc/routes/search";

export default implement(search)
  .$context<MockContext>()
  .handler(async ({ input, context }) => {
    const results: Outputs["search"]["results"] = [];
    const bottle = mockBottleFor(context.user);

    if (
      input.include.includes("bottles") &&
      includesQuery(input.query, bottle.fullName, bottle.name)
    ) {
      results.push({ type: "bottle", ref: bottle });
    }
    if (
      input.include.includes("entities") &&
      includesQuery(input.query, mockEntity.name, mockEntity.shortName)
    ) {
      results.push({ type: "entity", ref: mockEntity });
    }
    if (
      context.user &&
      input.include.includes("users") &&
      includesQuery(input.query, mockUser.username)
    ) {
      results.push({ type: "user", ref: mockUser });
    }

    return {
      query: input.query,
      results: results.slice(0, input.limit),
    };
  });
