import {
  includesQuery,
  mockBottleFor,
  mockExternalReviews,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.externalReviews.list.handler(
  async ({ input, context, errors }) => {
    if (
      input.site &&
      !mockExternalReviews.some(
        (externalReview) => externalReview.site?.type === input.site,
      )
    ) {
      throw errors.NOT_FOUND({
        message: "Mock external review site not found.",
      });
    }

    const hasPublicScope =
      input.bottle !== undefined || input.sort === "recent";
    const requiresModerator = input.onlyUnknown || !hasPublicScope;
    if (requiresModerator && !context.user?.admin && !context.user?.mod) {
      throw errors.BAD_REQUEST({
        message: "Must be a moderator to list all external reviews.",
      });
    }

    const externalReviews = mockExternalReviews
      .filter(
        (externalReview) =>
          (input.site === undefined ||
            externalReview.site?.type === input.site) &&
          (input.bottle === undefined ||
            externalReview.bottle?.id === input.bottle) &&
          (!input.onlyUnknown || externalReview.bottle === null) &&
          includesQuery(input.query, externalReview.name),
      )
      .toSorted((left, right) =>
        input.sort === "name"
          ? left.name.localeCompare(right.name)
          : right.createdAt.localeCompare(left.createdAt),
      )
      .map((externalReview) => ({
        ...externalReview,
        bottle: externalReview.bottle
          ? mockBottleFor(context.user, externalReview.bottle)
          : null,
      }));

    return mockPage(externalReviews, input.cursor, input.limit);
  },
);
