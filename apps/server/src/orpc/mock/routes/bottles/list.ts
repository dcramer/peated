import { implement } from "@orpc/server";
import {
  includesQuery,
  mockBottle,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import list from "@peated/server/orpc/routes/bottles/list";

export default implement(list).handler(async ({ input }) => ({
  results: includesQuery(input.query, mockBottle.fullName, mockBottle.name)
    ? [mockBottle]
    : [],
  rel: noMorePages,
  followedDistillerCount: input.filter === "following" ? 1 : null,
}));
