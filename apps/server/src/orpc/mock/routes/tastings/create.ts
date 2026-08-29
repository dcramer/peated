import {
  mockBottleDetailsList,
  mockBottleFor,
  mockFriends,
  mockImageUrls,
  mockTasting,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.create.handler(
  async ({ input, context, errors }) => {
    if (!context.user) throw errors.UNAUTHORIZED();

    const bottle = mockBottleDetailsList.find(
      (candidate) => candidate.id === input.bottle,
    );
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    const tasting = {
      ...mockTasting,
      id: Math.max(...mockTastings.map(({ id }) => id)) + 1,
      imageUrl: input.pendingImageId ? mockImageUrls.cairdeasWarehouse1 : null,
      notes: input.notes ?? null,
      bottle: mockBottleFor(context.user, bottle),
      ratingBand: input.ratingBand ?? null,
      tags: input.tags ?? [],
      color: input.color ?? null,
      servingStyle: input.servingStyle ?? null,
      friends: mockFriends.filter((friend) =>
        input.friends?.includes(friend.id),
      ),
      awards: [],
      comments: 0,
      toasts: 0,
      hasToasted: false,
      createdAt: input.createdAt ?? mockTasting.createdAt,
      createdBy: context.user,
    };

    mockTastings.push(tasting);
    return { tasting, awards: [] };
  },
);
