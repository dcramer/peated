import {
  includesQuery,
  mockBottle,
  mockBottleFor,
  mockCollectionBottle,
  mockEntity,
  mockUser,
  noMorePages,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const mockCollectionId = 9801;

export default mockOS.collections.bottles.list.handler(
  async ({ input, context, errors }) => {
    const userMatches =
      input.user === "me"
        ? Boolean(context.user)
        : input.user === mockUser.id || input.user === mockUser.username;
    if (!userMatches) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    const isLibrary = input.collection === "library";
    const isReserved =
      input.collection === "library" || input.collection === "default";
    if (!isReserved && input.collection !== mockCollectionId) {
      throw errors.NOT_FOUND({ message: "Mock collection not found." });
    }

    if (
      !isLibrary &&
      (input.query ||
        input.brand ||
        input.distiller ||
        (isReserved && input.status))
    ) {
      throw errors.BAD_REQUEST({
        message: "Collection filters are only supported for Library.",
      });
    }
    if (input.status && !isLibrary) {
      throw errors.BAD_REQUEST({
        message: "Status filtering is only supported for Library.",
      });
    }

    const statusMatches =
      input.status === undefined ||
      input.status === mockCollectionBottle.status ||
      (input.status === "unset" && mockCollectionBottle.status === null);
    const matches =
      includesQuery(
        input.query,
        mockBottle.fullName,
        mockBottle.name,
        mockEntity.name,
      ) &&
      (input.brand == null || input.brand === mockEntity.id) &&
      (input.distiller == null || input.distiller === mockEntity.id) &&
      (input.bottle === undefined || input.bottle === mockBottle.id) &&
      statusMatches;

    return {
      results: matches
        ? [
            {
              ...mockCollectionBottle,
              status: isLibrary ? mockCollectionBottle.status : null,
              bottle: mockBottleFor(context.user),
              hasTasted: Boolean(context.user),
            },
          ]
        : [],
      rel: noMorePages,
    };
  },
);
