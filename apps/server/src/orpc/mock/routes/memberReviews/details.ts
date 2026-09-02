import {
  mockMemberReviewFor,
  mockMemberReviews,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.memberReviews.details.handler(
  async ({ input, context, errors }) => {
    const review = mockMemberReviews.find(
      (candidate) => candidate.id === input.review,
    );

    if (!review) {
      throw errors.NOT_FOUND({ message: "Member review not found." });
    }

    return mockMemberReviewFor(context.user, review);
  },
);
