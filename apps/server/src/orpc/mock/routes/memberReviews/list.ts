import {
  mockMemberReviewFor,
  mockMemberReviews,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.memberReviews.list.handler(async ({ input, context }) => {
  const reviews = mockMemberReviews
    .filter((review) => review.bottleId === input.bottle)
    .map((review) => {
      const { bottle: _bottle, ...listReview } = mockMemberReviewFor(
        context.user,
        review,
      );
      return listReview;
    });

  return mockPage(reviews, input.cursor, input.limit);
});
