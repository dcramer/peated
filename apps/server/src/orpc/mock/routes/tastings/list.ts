import {
  mockFriends,
  mockPage,
  mockTastingFor,
  mockTastings,
  mockUser,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "friends" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const requestedUserId =
      input.user === "me"
        ? mockUser.id
        : [mockUser, ...mockFriends].find(
            (user) => user.id === input.user || user.username === input.user,
          )?.id;
    const knownUserIds = new Set([
      mockUser.id,
      ...mockTastings.map((tasting) => tasting.createdBy.id),
    ]);
    if (input.user !== undefined && !knownUserIds.has(requestedUserId ?? -1)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    const tastings = mockTastings.filter(
      (tasting) =>
        (requestedUserId === undefined ||
          tasting.createdBy.id === requestedUserId) &&
        (input.filter !== "friends" || tasting.createdBy.id !== mockUser.id) &&
        (input.bottle === undefined || tasting.bottle.id === input.bottle) &&
        (input.entity === undefined ||
          tasting.bottle.brand.id === input.entity ||
          tasting.bottle.distillers.some(
            (entity) => entity.id === input.entity,
          )),
    );

    return mockPage(
      tastings.map((tasting) => mockTastingFor(context.user, tasting)),
      input.cursor,
      input.limit,
    );
  },
);
