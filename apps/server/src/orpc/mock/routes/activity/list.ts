import {
  mockActivity,
  mockExternalReview,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.activity.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const memberActivity =
      input.filter === "friends"
        ? mockActivity.filter(
            (entry) => entry.createdBy.id !== context.user?.id,
          )
        : mockActivity;
    const activity = input.includeCriticReviews
      ? [
          {
            id: `critic_review:${mockExternalReview.id}`,
            type: "critic_review" as const,
            priority: "primary" as const,
            createdAt: mockExternalReview.article.publishedAt!,
            review: mockExternalReview,
          },
          ...memberActivity,
        ]
      : memberActivity;

    return {
      results: activity.slice(0, input.limit),
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    };
  },
);
