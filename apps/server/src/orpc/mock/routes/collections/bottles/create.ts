import {
  mockBottleDetailsList,
  mockBottleFor,
  mockCollectionBottles,
  mockImageUrls,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.collections.bottles.create.handler(
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
        message: "The mock API supports Library additions only.",
      });
    }

    const bottle = mockBottleDetailsList.find(
      (candidate) => candidate.id === input.bottle,
    );
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    const existing = mockCollectionBottles.find(
      (entry) => entry.bottle.id === bottle.id,
    );
    if (existing) {
      return {
        ...existing,
        bottle: mockBottleFor(context.user, existing.bottle),
      };
    }

    const entry = {
      id: Math.max(...mockCollectionBottles.map(({ id }) => id)) + 1,
      imageUrl: input.pendingImageId ? mockImageUrls.cairdeasWarehouse1 : null,
      status: input.status ?? null,
      bottle: mockBottleFor(context.user, bottle),
      hasTasted: bottle.hasTasted,
    };
    mockCollectionBottles.push(entry);
    return entry;
  },
);
