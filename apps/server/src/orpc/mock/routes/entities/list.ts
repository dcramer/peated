import { implement } from "@orpc/server";
import {
  includesQuery,
  mockEntity,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import list from "@peated/server/orpc/routes/entities/list";

export default implement(list).handler(async ({ input }) => ({
  results: includesQuery(input.query, mockEntity.name, mockEntity.shortName)
    ? [mockEntity]
    : [],
  rel: noMorePages,
}));
