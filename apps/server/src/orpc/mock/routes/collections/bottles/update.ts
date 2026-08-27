import {
  mockBottleFor,
  mockCollectionBottles,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.collections.bottles.update.handler(
  async ({ input, context, errors }) => {
    if (!context.user) throw errors.UNAUTHORIZED();
    if (
      input.user !== "me" &&
      input.user !== context.user.id &&
      input.user !== context.user.username
    ) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }
    if (input.collection !== "library") {
      throw errors.BAD_REQUEST({
        message: "Bottle status is only supported for Library entries.",
      });
    }
    const entry = mockCollectionBottles.find(
      (candidate) => candidate.id === input.collectionBottle,
    );
    if (!entry) {
      throw errors.NOT_FOUND({ message: "Mock collection bottle not found." });
    }
    return {
      ...entry,
      bottle: mockBottleFor(context.user, entry.bottle),
      status: input.status,
    };
  },
);
