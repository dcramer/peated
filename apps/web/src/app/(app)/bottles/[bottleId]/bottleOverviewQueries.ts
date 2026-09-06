import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";

/** Keeps server prefetches and client reads on the same query keys. */
export const bottleOverviewQueries = {
  recommendations: (orpc: ORPCQueryUtils, bottleId: number) =>
    orpc.bottles.recommendations.queryOptions({
      input: { bottle: bottleId, limit: 3 },
    }),
  reviewsAndTastings: (orpc: ORPCQueryUtils, bottleId: number) =>
    orpc.activity.reviewsAndTastings.queryOptions({
      input: { bottle: bottleId, limit: 6 },
    }),
  series: (orpc: ORPCQueryUtils, seriesId?: number) => ({
    ...orpc.bottles.list.queryOptions({
      input: { limit: 4, series: seriesId, sort: "-release" },
    }),
    enabled: Boolean(seriesId),
  }),
};
