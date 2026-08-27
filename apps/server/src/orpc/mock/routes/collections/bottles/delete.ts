import { mockCollectionBottles } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.collections.bottles.delete.handler(
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
      throw errors.NOT_FOUND({ message: "Mock collection not found." });
    }
    if (
      !mockCollectionBottles.some((entry) => entry.bottle.id === input.bottle)
    ) {
      return {};
    }
    return {};
  },
);
