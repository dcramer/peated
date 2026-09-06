import {
  mockBottles,
  mockExternalReviews,
  mockMemberReviewFor,
  mockMemberReviews,
  mockTastingFor,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.activity.reviewsAndTastings.handler(
  async ({ input, context }) => {
    const inScope = (bottleId: number) => {
      if (input.bottle) return bottleId === input.bottle;
      const bottle = mockBottles.find((item) => item.id === bottleId);
      return (
        bottle?.brand.id === input.entity ||
        bottle?.bottler?.id === input.entity ||
        bottle?.distillers.some((entity) => entity.id === input.entity)
      );
    };
    const results = [
      ...mockTastings
        .filter((item) => inScope(item.bottle.id))
        .map((tasting) => ({
          type: "tasting" as const,
          occurredAt: tasting.createdAt,
          tasting: mockTastingFor(context.user, tasting),
        })),
      ...mockMemberReviews
        .filter((item) => inScope(item.bottleId))
        .map((review) => ({
          type: "member_review" as const,
          occurredAt: review.createdAt,
          review: mockMemberReviewFor(context.user, review),
        })),
      ...mockExternalReviews
        .filter((item) => item.bottle && inScope(item.bottle.id))
        .map((review) => ({
          type: "critic_review" as const,
          occurredAt: review.article.publishedAt ?? review.createdAt,
          review,
        })),
    ]
      .toSorted((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )
      .slice(0, input.limit)
      .map(({ occurredAt: _occurredAt, ...item }) => item);

    return { results, rel: { nextCursor: null } };
  },
);
