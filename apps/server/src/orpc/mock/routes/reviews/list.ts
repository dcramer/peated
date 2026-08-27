import {
  includesQuery,
  mockBottleFor,
  mockReview,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.reviews.list.handler(
  async ({ input, context, errors }) => {
    if (input.site && input.site !== mockReview.site?.type) {
      throw errors.NOT_FOUND({ message: "Mock review site not found." });
    }

    const hasPublicScope =
      input.bottle !== undefined || input.sort === "recent";
    const requiresModerator = input.onlyUnknown || !hasPublicScope;
    if (requiresModerator && !context.user?.admin && !context.user?.mod) {
      throw errors.BAD_REQUEST({
        message: "Must be a moderator to list all reviews.",
      });
    }

    const review = {
      ...mockReview,
      bottle: mockBottleFor(context.user),
    };
    const matches =
      !input.onlyUnknown &&
      (input.bottle === undefined || input.bottle === review.bottle.id) &&
      includesQuery(input.query, review.name);

    return {
      results: matches ? [review] : [],
      rel: noMorePages,
    };
  },
);
