import {
  includesQuery,
  matchesMockUser,
  mockBottleFor,
  mockCollectionBottles,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const mockCollectionId = 9801;

export default mockOS.collections.bottles.list.handler(
  async ({ input, context, errors }) => {
    if (!matchesMockUser(input.user, context.user)) {
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

    const collectionBottles = mockCollectionBottles.filter(
      (item) =>
        includesQuery(
          input.query,
          item.bottle.fullName,
          item.bottle.name,
          item.bottle.brand.name,
        ) &&
        (input.brand == null || item.bottle.brand.id === input.brand) &&
        (input.distiller == null ||
          item.bottle.distillers.some(
            (entity) => entity.id === input.distiller,
          )) &&
        (input.bottle === undefined || item.bottle.id === input.bottle) &&
        (input.status === undefined ||
          input.status === item.status ||
          (input.status === "unset" && item.status === null)),
    );

    return mockPage(
      collectionBottles.map((item) => {
        const bottle = mockBottleFor(context.user, item.bottle);
        return {
          ...item,
          status: isLibrary ? item.status : null,
          bottle,
          hasTasted: bottle.hasTasted,
        };
      }),
      input.cursor,
      input.limit,
    );
  },
);
