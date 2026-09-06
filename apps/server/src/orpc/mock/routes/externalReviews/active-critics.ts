import { mockExternalReviews } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.externalReviews.activeCritics.handler(
  async ({ input }) => {
    const sites = new Set<string>();
    return mockExternalReviews
      .filter(
        (review) => review.site && review.bottle && review.article.publishedAt,
      )
      .toSorted((first, second) =>
        second.article.publishedAt!.localeCompare(first.article.publishedAt!),
      )
      .filter((review) => {
        if (sites.has(review.site!.type)) return false;
        sites.add(review.site!.type);
        return true;
      })
      .slice(0, input.limit)
      .map((review) => ({
        site: {
          type: review.site!.type,
          name: review.site!.name,
          imageUrl: review.site!.imageUrl,
        },
        latestReview: {
          bottleName: review.bottle!.fullName,
          publishedAt: review.article.publishedAt!,
          url: review.url,
        },
      }));
  },
);
