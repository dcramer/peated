import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const PAGE_LIMIT = 1000;

export default mockOS.bottles.sitemap.handler(async ({ input }) => ({
  results: mockBottles
    .toSorted((left, right) => left.id - right.id)
    .slice((input.page - 1) * PAGE_LIMIT, input.page * PAGE_LIMIT)
    .map(({ id, fullName, updatedAt }) => ({ id, fullName, updatedAt })),
}));
