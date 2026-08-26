import {
  includesQuery,
  mockEntity,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.list.handler(async ({ input }) => ({
  results: includesQuery(input.query, mockEntity.name, mockEntity.shortName)
    ? [mockEntity]
    : [],
  rel: noMorePages,
}));
