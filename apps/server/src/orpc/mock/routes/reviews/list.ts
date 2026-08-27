import {
  includesQuery,
  mockBottleFor,
  mockPage,
  mockReviews,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.reviews.list.handler(
  async ({ input, context, errors }) => {
    if (
      input.site &&
      !mockReviews.some((review) => review.site?.type === input.site)
    ) {
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

    const reviews = mockReviews
      .filter(
        (review) =>
          (input.site === undefined || review.site?.type === input.site) &&
          (input.bottle === undefined || review.bottle?.id === input.bottle) &&
          (!input.onlyUnknown || review.bottle === null) &&
          includesQuery(input.query, review.name),
      )
      .toSorted((left, right) =>
        input.sort === "name"
          ? left.name.localeCompare(right.name)
          : right.createdAt.localeCompare(left.createdAt),
      )
      .map((review) => ({
        ...review,
        bottle: review.bottle
          ? mockBottleFor(context.user, review.bottle)
          : null,
      }));

    return mockPage(reviews, input.cursor, input.limit);
  },
);
